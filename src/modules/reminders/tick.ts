import { getPrisma } from "@/lib/db/prisma";
import { forTenant } from "@/lib/db/tenant-client";
import { isUniqueViolation } from "@/lib/db/prisma-errors";
import { logger } from "@/lib/logger";
import { effectiveStatus } from "@/core/billing";
import { digitsFromJid } from "@/core/bot/evolution-normalize";
import { formatDayLabel, formatTimeLabel } from "@/core/bot/format";
import { DEFAULT_BOT_TEXTS, renderTemplate } from "@/core/bot/texts";
import { isInsideSendWindow, reminderFirstName, reminderStartsAtRange, whenLabel } from "@/core/reminders/window";
import { appendRecentOutbound } from "@/modules/bot-api/claim";
import { getEvolutionClient, type EvolutionClient } from "@/modules/whatsapp/evolution-client";

/**
 * Lembrete de véspera ao cliente final por WhatsApp. Roda DENTRO do tick horário de cobrança
 * (`src/modules/billing/tick.ts`), com a falha isolada lá: erro aqui nunca derruba a cobrança.
 *
 * Idempotência: o envio é "reservado" ANTES de mandar, com `updateMany` condicional
 * (`reminderSentAt` nulo -> `now`) — dois ticks concorrentes disputam a mesma linha e só um pega
 * `count === 1`. Se o envio falha, a reserva volta a nulo (só se ainda for a NOSSA — uma remarcação
 * concorrente que zerou/refez não é pisada).
 */

/** Teto de mensagens por rodada — o tick é horário; o resto entra na rodada seguinte (mais próximos primeiro). */
export const REMINDER_BATCH_LIMIT = 100;
/** Tentativas por agendamento (contadas em memória — ver `failedAttempts`). */
export const REMINDER_MAX_ATTEMPTS = 2;

export type ReminderTickSummary = {
  remindersToClientsSent: number;
  remindersToClientsFailed: number;
};

export type ReminderTickDeps = {
  /** Injetável nos testes; por padrão resolve o cliente real pelas credenciais da plataforma. */
  evolution?: EvolutionClient;
};

/**
 * Falhas por agendamento nesta instância do servidor. Sem coluna no schema para contar tentativas
 * (e sem alterá-lo), o limite é em memória: após `REMINDER_MAX_ATTEMPTS` falhas o agendamento é
 * abandonado ATÉ o processo reiniciar — e, mesmo assim, a repetição tem teto natural: some da
 * seleção quando faltar menos de 2h. Nunca é retry infinito.
 */
const failedAttempts = new Map<string, number>();
const FAILED_ATTEMPTS_MAX_ENTRIES = 5000;

function rememberFailure(appointmentId: string): number {
  if (failedAttempts.size >= FAILED_ATTEMPTS_MAX_ENTRIES) failedAttempts.clear();
  const next = (failedAttempts.get(appointmentId) ?? 0) + 1;
  failedAttempts.set(appointmentId, next);
  return next;
}

/** Só para testes. */
export function resetReminderFailureMemory(): void {
  failedAttempts.clear();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runReminderTick(now: Date = new Date(), deps: ReminderTickDeps = {}): Promise<ReminderTickSummary> {
  const summary: ReminderTickSummary = { remindersToClientsSent: 0, remindersToClientsFailed: 0 };
  const prisma = getPrisma();

  // Só empresas que PODEM enviar agora: lembrete ligado, número conectado de verdade (não sandbox)
  // e assinatura não suspensa/cancelada (status gravado é filtro barato; o efetivo é conferido abaixo).
  const tenants = await prisma.tenant.findMany({
    where: {
      reminderEnabled: true,
      subscription: { is: { status: { notIn: ["SUSPENDED", "CANCELED"] } } },
      whatsappInstances: { some: { status: "CONNECTED", sandbox: false, deletedAt: null } },
    },
    include: {
      subscription: true,
      whatsappInstances: { where: { status: "CONNECTED", sandbox: false, deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (tenants.length === 0) return summary;

  let evolution = deps.evolution;
  let budget = REMINDER_BATCH_LIMIT;

  for (const tenant of tenants) {
    if (budget <= 0) break;
    if (!tenant.subscription) continue;
    const status = effectiveStatus(tenant.subscription, now);
    if (status === "SUSPENDED" || status === "CANCELED") continue;
    // Horário de silêncio: espera o próximo tick dentro da janela (a seleção re-avalia o "> 2h").
    if (!isInsideSendWindow(now, tenant.timezone)) continue;

    try {
      const range = reminderStartsAtRange(now, tenant.reminderHoursBefore);
      const db = forTenant(tenant.id);
      const candidates = await db.appointment.findMany({
        where: { status: "SCHEDULED", reminderSentAt: null, startsAt: range },
        orderBy: { startsAt: "asc" },
        take: budget,
        include: {
          contact: { include: { chatSessions: { where: { humanUntil: { gt: now } }, select: { id: true } } } },
          service: { select: { name: true } },
          professional: { select: { name: true } },
        },
      });
      if (candidates.length === 0) continue;

      if (!evolution) {
        try {
          evolution = await getEvolutionClient();
        } catch (error) {
          logger.warn("reminders.tick.evolution_unavailable", { errorMessage: errorMessage(error) });
          return summary; // sem Evolution não há o que enviar para ninguém
        }
      }

      const template = await loadReminderTemplate(tenant.id);
      const connectedIds = new Set(tenant.whatsappInstances.map((i) => i.id));

      for (const appointment of candidates) {
        if (budget <= 0) break;
        const { contact } = appointment;
        // Bot pausado para o cliente ("pausar o bot" em Clientes, ou atendente humano assumiu).
        if ((contact.botPausedUntil && contact.botPausedUntil > now) || contact.chatSessions.length > 0) continue;
        if ((failedAttempts.get(appointment.id) ?? 0) >= REMINDER_MAX_ATTEMPTS) continue;

        const number = recipientNumber(contact);
        if (!number) continue;

        const instance =
          tenant.whatsappInstances.find((i) => i.id === appointment.whatsappInstanceId && connectedIds.has(i.id)) ??
          tenant.whatsappInstances[0];
        if (!instance) continue;

        const text = renderTemplate(template, {
          nome: reminderFirstName(contact.name, contact.pushName),
          empresa: tenant.name,
          servico: appointment.service.name,
          profissional: appointment.professional.name,
          data: formatDayLabel(appointment.startsAt, tenant.timezone),
          hora: formatTimeLabel(appointment.startsAt, tenant.timezone),
          quando: whenLabel(appointment.startsAt, now, tenant.timezone),
        });

        budget -= 1;
        const sent = await sendOne({
          evolution,
          tenantId: tenant.id,
          appointment,
          contactId: contact.id,
          instance,
          number,
          text,
          now,
          range,
        });
        if (sent === true) summary.remindersToClientsSent += 1;
        else if (sent === false) summary.remindersToClientsFailed += 1;
      }
    } catch (error) {
      // Uma empresa com problema nunca impede as demais.
      logger.error("reminders.tick.tenant_failed", { tenantId: tenant.id, errorMessage: errorMessage(error) });
    }
  }

  logger.info("reminders.tick.completed", { ...summary });
  return summary;
}

async function loadReminderTemplate(tenantId: string): Promise<string> {
  const row = await forTenant(tenantId).botText.findFirst({ where: { key: "REMINDER" } });
  return row?.text ?? DEFAULT_BOT_TEXTS.REMINDER;
}

function recipientNumber(contact: { waJid: string; phoneE164: string | null }): string | null {
  if (contact.waJid.endsWith("@s.whatsapp.net")) {
    const digits = digitsFromJid(contact.waJid).replace(/\D/g, "");
    if (digits) return digits;
  }
  const fromPhone = (contact.phoneE164 ?? "").replace(/\D/g, "");
  return fromPhone || null;
}

/** `true` = enviado; `false` = falhou (reserva desfeita); `null` = outro tick/remarcação levou a vez. */
async function sendOne(params: {
  evolution: EvolutionClient;
  tenantId: string;
  appointment: { id: string; startsAt: Date };
  contactId: string;
  instance: { id: string; instanceName: string };
  number: string;
  text: string;
  now: Date;
  range: { gt: Date; lte: Date };
}): Promise<boolean | null> {
  const { evolution, tenantId, appointment, instance, text, now } = params;
  const db = forTenant(tenantId);

  // Reserva atômica ANTES de enviar. Reconfere status, horário e a janela de "> 2h" na própria
  // condição: uma remarcação/cancelamento entre a leitura e aqui faz `count === 0`.
  const reserved = await db.appointment.updateMany({
    where: {
      id: appointment.id,
      status: "SCHEDULED",
      reminderSentAt: null,
      startsAt: { equals: appointment.startsAt, gt: params.range.gt },
    },
    data: { reminderSentAt: now },
  });
  if (reserved.count === 0) return null;

  try {
    // O Evolution devolve o nosso envio como evento `fromMe`; o `claim` trataria isso como "um
    // humano assumiu" e pausaria o bot para o cliente por horas — quebrando o "responda menu".
    // Registrar o hash na sessão faz o `claim` reconhecer o eco. Antes do envio: o webhook pode
    // chegar antes do retorno do POST.
    await registerOutboundEcho(instance.id, params.contactId, text, now);
    const { messageId } = await evolution.sendText(instance.instanceName, params.number, text);
    await recordOutboundMessage({ tenantId, contactId: params.contactId, instanceId: instance.id, text, providerMessageId: messageId });
    failedAttempts.delete(appointment.id);
    logger.info("reminders.sent", { tenantId, appointmentId: appointment.id });
    return true;
  } catch (error) {
    // Desfaz SÓ a nossa reserva (mesmo carimbo) — não pisa numa remarcação que já zerou/refez.
    await db.appointment
      .updateMany({ where: { id: appointment.id, reminderSentAt: now }, data: { reminderSentAt: null } })
      .catch((rollbackError) => {
        logger.error("reminders.rollback_failed", { tenantId, appointmentId: appointment.id, errorMessage: errorMessage(rollbackError) });
      });
    const attempts = rememberFailure(appointment.id);
    logger.warn("reminders.send_failed", {
      tenantId,
      appointmentId: appointment.id,
      attempts,
      gaveUp: attempts >= REMINDER_MAX_ATTEMPTS,
      errorMessage: errorMessage(error),
    });
    return false;
  }
}

async function registerOutboundEcho(instanceId: string, contactId: string, text: string, now: Date): Promise<void> {
  const prisma = getPrisma();
  const session = await prisma.chatSession.upsert({
    where: { whatsappInstanceId_contactId: { whatsappInstanceId: instanceId, contactId } },
    update: {},
    create: { whatsappInstanceId: instanceId, contactId, state: "MAIN_MENU", lastInboundAt: now },
  });
  await prisma.chatSession.update({
    where: { id: session.id },
    data: { recentOutbound: appendRecentOutbound(session.recentOutbound, [text], now) },
  });
}

async function recordOutboundMessage(params: {
  tenantId: string;
  contactId: string;
  instanceId: string;
  text: string;
  providerMessageId: string | null;
}): Promise<void> {
  try {
    await forTenant(params.tenantId).chatMessage.create({
      data: {
        tenantId: params.tenantId,
        contactId: params.contactId,
        whatsappInstanceId: params.instanceId,
        direction: "OUTBOUND",
        body: params.text,
        providerMessageId: params.providerMessageId,
      },
    });
  } catch (error) {
    // A mensagem JÁ foi enviada: falha em registrar no histórico (ou id repetido, gravado antes pelo
    // eco do webhook) nunca desfaz a reserva nem conta como falha de envio.
    if (!isUniqueViolation(error)) {
      logger.error("reminders.history_record_failed", { tenantId: params.tenantId, errorMessage: errorMessage(error) });
    }
  }
}
