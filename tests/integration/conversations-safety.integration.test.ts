/**
 * Histórico de conversas — proteções de privacidade e abuso, contra Postgres real:
 * conversa pessoal do dono (fromMe) não vira contato/histórico, teto de INBOUND por contato/dia,
 * NUL removido do corpo e logs de falha que NUNCA carregam o texto da mensagem.
 */
import { randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { hashInternalApiSecret } from "@/modules/platform/service";
import type { InternalApiContext } from "@/modules/bot-api/internal-auth";
import { claimMessage } from "@/modules/bot-api/claim";
import { CHAT_INBOUND_DAILY_CAP, logChatMessage, logOutboundTexts, resetInboundCapLogMemory } from "@/modules/conversations/log";
import { logger } from "@/lib/logger";

const prisma = getPrisma();
const tenantIds: string[] = [];
let planId: string | null = null;

async function getPlanId() {
  if (!planId) {
    const plan = await prisma.plan.create({
      data: { code: `it-convsafe-${randomUUID().slice(0, 8)}`, name: "Plano IT conv safety", priceCents: 0, maxWhatsappNumbers: 5, maxProfessionals: null, active: false, sortOrder: 999 },
    });
    planId = plan.id;
  }
  return planId;
}

async function makeWorld(label: string) {
  const tenant = await prisma.tenant.create({ data: { slug: `it-convsafe-${label}-${randomUUID().slice(0, 8)}`, name: `Safe ${label}`, timezone: "UTC" } });
  tenantIds.push(tenant.id);
  await prisma.subscription.create({ data: { tenantId: tenant.id, planId: await getPlanId(), status: "ACTIVE", currentPeriodEnd: addDays(new Date(), 30) } });
  const instance = await prisma.whatsappInstance.create({
    data: { tenantId: tenant.id, instanceName: `it-convsafe-${label}-${randomUUID().slice(0, 8)}`, label: `Numero ${label}`, webhookToken: randomUUID() },
  });
  const ctx: InternalApiContext = {
    tenantId: tenant.id,
    instance: { id: instance.id, tenantId: tenant.id, instanceName: instance.instanceName, sandbox: instance.sandbox, status: instance.status },
  };
  return { tenant, instance, ctx };
}

function payload(opts: { instance: string; jid: string; id: string; text: string; fromMe?: boolean }) {
  return {
    event: "messages.upsert",
    instance: opts.instance,
    data: {
      key: { remoteJid: opts.jid, fromMe: opts.fromMe ?? false, id: opts.id },
      pushName: "Cliente",
      message: { conversation: opts.text },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };
}

let seq = 0;
const nextJid = () => `5511${String(800000000 + ++seq * 11 + Math.floor(Math.random() * 1000))}@s.whatsapp.net`;

beforeEach(async () => {
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, internalApiSecretHash: hashInternalApiSecret("test-internal-secret-0123456789") },
    update: {},
  });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  if (planId) await prisma.plan.delete({ where: { id: planId } });
  await prisma.$disconnect();
});

describe("conversa pessoal do dono (fromMe)", () => {
  it("número que nunca falou com a empresa: não vira Contato, sessão nem histórico", async () => {
    const { tenant, instance, ctx } = await makeWorld("personal");

    const res = await claimMessage(ctx, payload({ instance: instance.instanceName, jid: nextJid(), id: `pf-${randomUUID()}`, text: "passo aí no sábado", fromMe: true }));

    expect(res.action).toBe("ignore");
    expect(await prisma.contact.count({ where: { tenantId: tenant.id } })).toBe(0);
    expect(await prisma.chatSession.count({ where: { whatsappInstanceId: instance.id } })).toBe(0);
    expect(await prisma.chatMessage.count({ where: { tenantId: tenant.id } })).toBe(0);
  });

  it("contato existente SEM mensagem recebida nem agendamento: não grava; com agendamento: grava", async () => {
    const { tenant, instance, ctx } = await makeWorld("norelation");
    const jid = nextJid();
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: jid } });

    await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id: `nr1-${randomUUID()}`, text: "conversa pessoal", fromMe: true }));
    expect(await prisma.chatMessage.count({ where: { tenantId: tenant.id } })).toBe(0);

    const service = await prisma.service.create({ data: { tenantId: tenant.id, name: "Corte", durationMin: 30 } });
    const professional = await prisma.professional.create({ data: { tenantId: tenant.id, name: "Ana" } });
    const startsAt = new Date(Date.now() + 5 * 24 * 3_600_000);
    await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        contactId: contact.id,
        serviceId: service.id,
        professionalId: professional.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        blockEndsAt: new Date(startsAt.getTime() + 30 * 60_000),
        status: "SCHEDULED",
      },
    });
    await prisma.chatSession.updateMany({ where: { whatsappInstanceId: instance.id }, data: { lockToken: null, lockedUntil: null, state: "MAIN_MENU", humanUntil: null } });
    await prisma.contact.update({ where: { id: contact.id }, data: { botPausedUntil: null } });

    await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id: `nr2-${randomUUID()}`, text: "confirmando seu horário", fromMe: true }));
    const rows = await prisma.chatMessage.findMany({ where: { tenantId: tenant.id } });
    expect(rows.map((r) => [r.direction, r.body])).toEqual([["OUTBOUND", "confirmando seu horário"]]);
  });
});

describe("teto de mensagens recebidas por contato por dia", () => {
  it("acima do teto não grava, loga o id uma única vez, e a saída (OUTBOUND) não é afetada", async () => {
    resetInboundCapLogMemory();
    const { tenant, instance } = await makeWorld("cap");
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid() } });
    await prisma.chatMessage.createMany({
      data: Array.from({ length: CHAT_INBOUND_DAILY_CAP }, (_, i) => ({
        tenantId: tenant.id,
        contactId: contact.id,
        whatsappInstanceId: instance.id,
        direction: "INBOUND" as const,
        body: `m${i}`,
      })),
    });
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    try {
      const entry = { tenantId: tenant.id, whatsappInstanceId: instance.id, contactId: contact.id, direction: "INBOUND" as const };
      expect(await logChatMessage({ ...entry, body: "a mais 1" })).toBe(false);
      expect(await logChatMessage({ ...entry, body: "a mais 2" })).toBe(false);
      expect(await prisma.chatMessage.count({ where: { contactId: contact.id } })).toBe(CHAT_INBOUND_DAILY_CAP);

      const capLogs = warn.mock.calls.filter((c) => c[0] === "conversations.inbound_cap_reached");
      expect(capLogs).toHaveLength(1);
      expect(capLogs[0]![1]).toMatchObject({ contactId: contact.id });

      expect(await logChatMessage({ ...entry, direction: "OUTBOUND", body: "resposta" })).toBe(true);
    } finally {
      warn.mockRestore();
    }
  });
});

describe("corpo da mensagem no banco e nos logs", () => {
  it("NUL e outros caracteres de controle são removidos antes de gravar (o Postgres recusaria o NUL)", async () => {
    const { tenant, instance } = await makeWorld("nul");
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid() } });

    const ok = await logChatMessage({
      tenantId: tenant.id,
      whatsappInstanceId: instance.id,
      contactId: contact.id,
      direction: "INBOUND",
      body: "ol\u0000á\u0007 tudo\u0001 bem\n?",
    });

    expect(ok).toBe(true);
    const row = await prisma.chatMessage.findFirstOrThrow({ where: { contactId: contact.id } });
    expect(row.body).toBe("olá tudo bem\n?");
  });

  it("falha ao gravar NUNCA loga o corpo (nem em errorMessage): só nome e code do erro", async () => {
    const { tenant, instance } = await makeWorld("logsafe");
    const SECRET = "SEGREDO-CPF-123.456.789-00";
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    try {
      // 1) violação de FK (contato inexistente): P2003
      await logChatMessage({ tenantId: tenant.id, whatsappInstanceId: instance.id, contactId: "nao-existe", direction: "OUTBOUND", body: SECRET });
      // 2) erro de validação do Prisma: a mensagem dele reproduz os argumentos, incluindo o corpo
      await logChatMessage({ tenantId: tenant.id, whatsappInstanceId: instance.id, contactId: "nao-existe", direction: "SIDEWAYS" as never, body: SECRET });
      // 3) mesmo caminho na saída em lote
      await logOutboundTexts({ tenantId: tenant.id, whatsappInstanceId: instance.id, contactId: "nao-existe", texts: [SECRET] });

      expect(warn.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(JSON.stringify(warn.mock.calls)).not.toContain("SEGREDO");
      for (const call of warn.mock.calls) expect(call[1]).not.toHaveProperty("errorMessage");
      const fk = warn.mock.calls.find((c) => c[0] === "conversations.log_failed");
      expect(fk![1]).toMatchObject({ errorName: expect.any(String), code: "P2003" });
    } finally {
      warn.mockRestore();
    }
  });
});
