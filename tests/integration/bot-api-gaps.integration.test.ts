/**
 * Lacunas de integração da API do bot sinalizadas pela Vega (docs/contratos.md, Fase 4 — "Não
 * coberto ainda"): eco `fromMe`, `HUMAN_TOOK_OVER`, `BOT_PAUSED`/`HUMAN_MODE`, expiração de
 * sessão, `STALE`, `TOO_LATE` em cancelar/remarcar pelo bot, `PATCH /contacts`,
 * `/connection-events`, e `TENANT_SUSPENDED` (subscription-gate ligado pelo Atlas).
 *
 * Mesma convenção de `tests/integration/bot-api.integration.test.ts`: chama a lógica de módulo
 * direto, requer `TEST_DATABASE_URL` com migrations aplicadas.
 */
import { randomUUID, createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { hashInternalApiSecret } from "@/modules/platform/service";
import type { InternalApiContext } from "@/modules/bot-api/internal-auth";
import { claimMessage } from "@/modules/bot-api/claim";
import { updateSession } from "@/modules/bot-api/session";
import { createAppointmentBot, cancelAppointmentBot, rescheduleAppointmentBot } from "@/modules/bot-api/booking-bot";
import { updateContactName } from "@/modules/bot-api/contacts-bot";
import { applyConnectionEvent } from "@/modules/bot-api/connection-events";
import { createProfessional, createService, setProfessionalServices, setProfessionalWorkingHours } from "@/modules/agenda/catalog";

const prisma = getPrisma();
const INTERNAL_SECRET = "test-internal-secret-0123456789";

function evolutionTextPayload(opts: { instance: string; jid: string; id: string; text: string; fromMe?: boolean; timestamp?: number }) {
  return {
    event: "messages.upsert",
    instance: opts.instance,
    data: {
      key: { remoteJid: opts.jid, fromMe: opts.fromMe ?? false, id: opts.id },
      pushName: "Cliente Teste",
      message: { conversation: opts.text },
      messageType: "conversation",
      messageTimestamp: opts.timestamp ?? Math.floor(Date.now() / 1000),
    },
  };
}

function nextWeekdayAt(daysAhead: number, hourUTCLocal: string): { date: Date; weekday: number } {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + daysAhead);
  const [h, m] = hourUTCLocal.split(":").map(Number);
  const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0, 0));
  return { date, weekday: date.getUTCDay() };
}

const createdTenantIds: string[] = [];
let botPlanId: string | null = null;

async function getBotPlanId() {
  if (!botPlanId) {
    const plan = await prisma.plan.create({
      data: { code: `it-botgap-${Date.now()}-${randomUUID().slice(0, 6)}`, name: "Plano IT bot gaps", priceCents: 0, maxWhatsappNumbers: 3, maxProfessionals: null, active: false, sortOrder: 999 },
    });
    botPlanId = plan.id;
  }
  return botPlanId;
}

async function makeTenantWithInstance(label: string, opts?: { subscriptionStatus?: "ACTIVE" | "SUSPENDED" | "CANCELED"; sessionTimeoutMin?: number; humanPauseMin?: number; cancelMinLeadMin?: number }) {
  const tenant = await prisma.tenant.create({
    data: {
      slug: `it-botgap-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`,
      name: `Bot Gaps ${label}`,
      timezone: "UTC",
      minLeadTimeMin: 0,
      maxHorizonDays: 60,
      ...(opts?.sessionTimeoutMin !== undefined ? { sessionTimeoutMin: opts.sessionTimeoutMin } : {}),
      ...(opts?.humanPauseMin !== undefined ? { humanPauseMin: opts.humanPauseMin } : {}),
      ...(opts?.cancelMinLeadMin !== undefined ? { cancelMinLeadMin: opts.cancelMinLeadMin } : {}),
    },
  });
  createdTenantIds.push(tenant.id);

  if (opts?.subscriptionStatus !== undefined && opts.subscriptionStatus !== "ACTIVE") {
    // SUSPENDED/CANCELED: subscription-gate lê o status EFETIVO, calculado a partir de
    // trial/currentPeriodEnd — a forma mais direta de forçar SUSPENDED sem depender do relógio é
    // um período já vencido há muito tempo com status persistido SUSPENDED.
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: await getBotPlanId(),
        status: opts.subscriptionStatus,
        currentPeriodEnd: new Date(Date.now() - 90 * 86_400_000),
      },
    });
  } else {
    await prisma.subscription.create({
      data: { tenantId: tenant.id, planId: await getBotPlanId(), status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
    });
  }

  const instance = await prisma.whatsappInstance.create({
    data: {
      tenantId: tenant.id,
      instanceName: `innochat-gap-${label}-${randomUUID().slice(0, 6)}`,
      label: "Principal",
      webhookToken: randomUUID(),
      sandbox: false,
    },
  });

  const ctx: InternalApiContext = {
    tenantId: tenant.id,
    instance: { id: instance.id, tenantId: tenant.id, instanceName: instance.instanceName, sandbox: instance.sandbox, status: instance.status },
  };

  return { tenant, instance, ctx };
}

async function ensureInternalSecret() {
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, internalApiSecretHash: hashInternalApiSecret(INTERNAL_SECRET) },
    update: { internalApiSecretHash: hashInternalApiSecret(INTERNAL_SECRET) },
  });
}

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  if (botPlanId) await prisma.plan.delete({ where: { id: botPlanId } });
  await prisma.$disconnect();
});

describe("eco fromMe e humano assume (§6.2)", () => {
  it("fromMe cujo texto bate com uma saída recente registrada → FROM_ME_ECHO, sessão continua travável", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("echo");
    const jid = "5511900010001@s.whatsapp.net";

    const claimed = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "echo-in-1", text: "oi" }));
    if (claimed.action !== "process") throw new Error("esperava process");

    // Grava uma saída recente com o MESMO texto que o próximo fromMe vai reenviar (o bot "ecoa"
    // sua própria mensagem, como a Evolution reenvia fromMe de números conectados via app).
    await updateSession(ctx, claimed.session.id, {
      lockToken: claimed.session.lockToken,
      version: claimed.session.version,
      state: "MAIN_MENU",
      context: {},
      invalidCount: 0,
      outbound: ["Olá! Como posso ajudar?"],
      handoff: false,
    });

    const echoed = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "echo-fromme-1", text: "Olá! Como posso ajudar?", fromMe: true }));
    expect(echoed).toEqual({ action: "ignore", reason: "FROM_ME_ECHO" });

    // Sessão não ficou travada por causa do eco: uma mensagem normal seguinte processa.
    const after = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "echo-in-2", text: "1" }));
    expect(after.action).toBe("process");
  });

  it("fromMe cujo texto NÃO bate com nada recente → HUMAN_TOOK_OVER, sessão vira HUMAN e contato fica pausado", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("human-takeover", { humanPauseMin: 60 });
    const jid = "5511900010002@s.whatsapp.net";

    const claimed = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "ht-in-1", text: "oi" }));
    if (claimed.action !== "process") throw new Error("esperava process");
    // Libera a trava sem gravar outbound, para simular "atendente respondeu direto pelo WhatsApp".
    await prisma.chatSession.update({ where: { id: claimed.session.id }, data: { lockToken: null, lockedUntil: null } });

    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "ht-fromme-1", text: "Pode vir amanhã às 10h", fromMe: true }));
    expect(result).toEqual({ action: "ignore", reason: "HUMAN_TOOK_OVER" });

    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: ctx.tenantId, waJid: jid } });
    expect(contact.botPausedUntil).not.toBeNull();
    expect(contact.botPausedUntil!.getTime()).toBeGreaterThan(Date.now());

    const session = await prisma.chatSession.findFirstOrThrow({ where: { whatsappInstanceId: ctx.instance.id, contactId: contact.id } });
    expect(session.state).toBe("HUMAN");
    expect(session.humanUntil).not.toBeNull();
  });
});

describe("modo humano e bot pausado bloqueiam o claim (§6.2)", () => {
  it("contact.botPausedUntil no futuro → BOT_PAUSED, mesmo em mensagem normal (não fromMe)", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("bot-paused");
    const jid = "5511900010003@s.whatsapp.net";

    const contact = await prisma.contact.create({
      data: { tenantId: ctx.tenantId, waJid: jid, botPausedUntil: new Date(Date.now() + 60 * 60_000) },
    });

    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "paused-1", text: "oi" }));
    expect(result).toEqual({ action: "ignore", reason: "BOT_PAUSED" });

    const events = await prisma.inboundEvent.findMany({ where: { whatsappInstanceId: ctx.instance.id, providerMessageId: "paused-1" } });
    expect(events).toHaveLength(1);
    expect(events[0].reason).toBe("BOT_PAUSED");
    void contact;
  });

  it("chatSession em HUMAN com humanUntil no futuro → HUMAN_MODE", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("human-mode");
    const jid = "5511900010004@s.whatsapp.net";

    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: jid } });
    await prisma.chatSession.create({
      data: {
        whatsappInstanceId: ctx.instance.id,
        contactId: contact.id,
        state: "HUMAN",
        humanUntil: new Date(Date.now() + 60 * 60_000),
        lastInboundAt: new Date(),
      },
    });

    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "hm-1", text: "oi" }));
    expect(result).toEqual({ action: "ignore", reason: "HUMAN_MODE" });
  });

  it("HUMAN com humanUntil no PASSADO não bloqueia (expirou) — processa normalmente", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("human-mode-expired");
    const jid = "5511900010005@s.whatsapp.net";

    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: jid } });
    await prisma.chatSession.create({
      data: {
        whatsappInstanceId: ctx.instance.id,
        contactId: contact.id,
        state: "HUMAN",
        humanUntil: new Date(Date.now() - 60_000),
        lastInboundAt: new Date(Date.now() - 60_000),
      },
    });

    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "hm-exp-1", text: "oi" }));
    expect(result.action).toBe("process");
  });
});

describe("expiração de sessão e STALE (§6.2)", () => {
  it("lastInboundAt mais antigo que sessionTimeoutMin → sessão reinicia (MAIN_MENU, context {}) e expired=true", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("session-expired", { sessionTimeoutMin: 5 });
    const jid = "5511900010006@s.whatsapp.net";

    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: jid } });
    await prisma.chatSession.create({
      data: {
        whatsappInstanceId: ctx.instance.id,
        contactId: contact.id,
        state: "SELECT_SERVICE",
        context: { serviceId: "algum-servico-antigo" },
        invalidCount: 2,
        lastInboundAt: new Date(Date.now() - 10 * 60_000), // 10 min > 5 min de timeout
      },
    });

    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "expired-1", text: "oi" }));
    if (result.action !== "process") throw new Error("esperava process");
    expect(result.session.expired).toBe(true);
    expect(result.session.state).toBe("MAIN_MENU");
    expect(result.session.context).toEqual({});
    expect(result.session.invalidCount).toBe(0);

    const row = await prisma.chatSession.findUniqueOrThrow({ where: { id: result.session.id } });
    expect(row.state).toBe("MAIN_MENU");
    expect(row.context).toEqual({});
  });

  it("lastInboundAt dentro do timeout → NÃO expira, preserva estado/contexto", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("session-not-expired", { sessionTimeoutMin: 30 });
    const jid = "5511900010007@s.whatsapp.net";

    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: jid } });
    await prisma.chatSession.create({
      data: {
        whatsappInstanceId: ctx.instance.id,
        contactId: contact.id,
        state: "SELECT_SERVICE",
        context: { serviceId: "abc" },
        invalidCount: 1,
        lastInboundAt: new Date(Date.now() - 60_000), // 1 min, bem dentro do timeout de 30
      },
    });

    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "not-expired-1", text: "oi" }));
    if (result.action !== "process") throw new Error("esperava process");
    expect(result.session.expired).toBe(false);
    expect(result.session.state).toBe("SELECT_SERVICE");
    expect(result.session.context).toEqual({ serviceId: "abc" });
    expect(result.session.invalidCount).toBe(1);
  });

  it("mensagem com timestamp mais antigo que 5 min (STALE) → ignorada, sem processar", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("stale");
    const jid = "5511900010008@s.whatsapp.net";

    const oldTimestamp = Math.floor((Date.now() - 10 * 60_000) / 1000); // 10 min atrás
    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "stale-1", text: "oi", timestamp: oldTimestamp }));
    expect(result).toEqual({ action: "ignore", reason: "STALE" });

    const events = await prisma.inboundEvent.findMany({ where: { whatsappInstanceId: ctx.instance.id, providerMessageId: "stale-1" } });
    expect(events).toHaveLength(1);
    expect(events[0].reason).toBe("STALE");
  });

  it("mensagem recente (dentro de 5 min) NÃO é STALE", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("not-stale");
    const jid = "5511900010009@s.whatsapp.net";

    const recentTimestamp = Math.floor((Date.now() - 60_000) / 1000); // 1 min atrás
    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "not-stale-1", text: "oi", timestamp: recentTimestamp }));
    expect(result.action).toBe("process");
  });
});

describe("TENANT_SUSPENDED bloqueia o bot (subscription-gate, §2 regra 8/§7.4)", () => {
  it("assinatura SUSPENDED (persistida + período vencido) → claim devolve ignore/TENANT_SUSPENDED", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("suspended", { subscriptionStatus: "SUSPENDED" });
    const jid = "5511900010010@s.whatsapp.net";

    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "susp-1", text: "oi" }));
    expect(result).toEqual({ action: "ignore", reason: "TENANT_SUSPENDED" });

    const events = await prisma.inboundEvent.findMany({ where: { whatsappInstanceId: ctx.instance.id, providerMessageId: "susp-1" } });
    expect(events).toHaveLength(1);
    expect(events[0].reason).toBe("TENANT_SUSPENDED");

    // A trava foi liberada mesmo bloqueando — não deixa a sessão presa.
    const contact = await prisma.contact.findFirstOrThrow({ where: { tenantId: ctx.tenantId, waJid: jid } });
    const session = await prisma.chatSession.findFirstOrThrow({ where: { whatsappInstanceId: ctx.instance.id, contactId: contact.id } });
    expect(session.lockToken).toBeNull();
  });

  it("empresa sem Subscription nenhuma (dado inconsistente) → fail-closed, também TENANT_SUSPENDED", async () => {
    await ensureInternalSecret();
    const tenant = await prisma.tenant.create({
      data: { slug: `it-botgap-nosub-${Date.now()}-${randomUUID().slice(0, 6)}`, name: "Sem assinatura", timezone: "UTC", minLeadTimeMin: 0, maxHorizonDays: 60 },
    });
    createdTenantIds.push(tenant.id);
    const instance = await prisma.whatsappInstance.create({
      data: { tenantId: tenant.id, instanceName: `innochat-nosub-${randomUUID().slice(0, 6)}`, label: "Principal", webhookToken: randomUUID(), sandbox: false },
    });
    const ctx: InternalApiContext = { tenantId: tenant.id, instance: { id: instance.id, tenantId: tenant.id, instanceName: instance.instanceName, sandbox: instance.sandbox, status: instance.status } };

    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900010011@s.whatsapp.net", id: "nosub-1", text: "oi" }));
    expect(result).toEqual({ action: "ignore", reason: "TENANT_SUSPENDED" });
  });

  it("assinatura ACTIVE não é bloqueada (controle negativo)", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("active-control");
    const result = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900010012@s.whatsapp.net", id: "active-1", text: "oi" }));
    expect(result.action).toBe("process");
  });
});

describe("TOO_LATE em cancelar/remarcar pelo bot (§6.5)", () => {
  async function setupBookableSoon(label: string, cancelMinLeadMin: number) {
    const { ctx } = await makeTenantWithInstance(label, { cancelMinLeadMin });
    const service = await createService(ctx.tenantId, { name: "Corte", durationMin: 30, bufferAfterMin: 0, priceCents: 8000, active: true, sortOrder: 0 });
    const professional = await createProfessional(ctx.tenantId, { name: "Ana", active: true, sortOrder: 0 });
    await setProfessionalServices(ctx.tenantId, professional.id, [service.id]);
    // Expediente 24h em todos os dias da semana, para o agendamento "daqui a 30 min" sempre caber.
    await setProfessionalWorkingHours(
      ctx.tenantId,
      professional.id,
      [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "00:00", endTime: "23:59" })),
    );
    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: `5511900011${label.length}00@s.whatsapp.net` } });
    return { ctx, service, professional, contact };
  }

  it("cancelar um agendamento dentro do prazo mínimo → TOO_LATE", async () => {
    // cancelMinLeadMin bem alto (12h) garante que "daqui a 30 min" está dentro da janela protegida.
    const { ctx, service, professional, contact } = await setupBookableSoon("too-late-cancel", 720);
    const startsAt = new Date(Date.now() + 30 * 60_000);
    const created = await createAppointmentBot(ctx, { contactId: contact.id, serviceId: service.id, professionalId: professional.id, startsAt, idempotencyKey: "too-late-cancel-1" });

    await expect(cancelAppointmentBot(ctx, created.appointment.id, contact.id)).rejects.toMatchObject({ code: "TOO_LATE" });
  });

  it("remarcar um agendamento dentro do prazo mínimo → TOO_LATE", async () => {
    const { ctx, service, professional, contact } = await setupBookableSoon("too-late-reschedule", 720);
    const startsAt = new Date(Date.now() + 30 * 60_000);
    const created = await createAppointmentBot(ctx, { contactId: contact.id, serviceId: service.id, professionalId: professional.id, startsAt, idempotencyKey: "too-late-resched-1" });

    const newStart = new Date(Date.now() + 3 * 60 * 60_000);
    await expect(rescheduleAppointmentBot(ctx, created.appointment.id, contact.id, newStart)).rejects.toMatchObject({ code: "TOO_LATE" });
  });

  it("cancelar fora do prazo mínimo funciona normalmente (controle negativo)", async () => {
    const { ctx, service, professional, contact } = await setupBookableSoon("ok-cancel", 5); // só 5 min de prazo mínimo
    // 90 min à frente — NUNCA exatos 60 min. `Tenant.minLeadTimeMin` (checado por
    // `createAppointmentManual`) tem `@default(60)` no schema, e este tenant não o sobrescreve
    // (só `cancelMinLeadMin`, um campo diferente). Um `startsAt` de exatos "+60min" cai bem em
    // cima do limiar: entre este `Date.now()` e o `now` que o SERVIDOR recaptura minutos depois
    // (após as idas ao banco de `createAppointmentBot`), alguns milissegundos já passaram —
    // `start < addMinutes(nowServidor, 60)` vira verdadeiro e o create falha com
    // `RULE_VIOLATION`/`LEAD_TIME`, mesmo a intenção do teste sendo "bem fora da janela de
    // prazo". Bug do TESTE (limiar sem margem), não do produto — corrigido aqui com folga real.
    // Flake da meia-noite: o expediente é "00:00–23:59" por dia, então um agendamento de 30 min que
    // atravessa a meia-noite (UTC ou de São Paulo) não cabe em nenhum dia e o create falha. Por isso
    // o horário é AMANHÃ às 15:00 UTC (12:00 em São Paulo): longe de qualquer virada de dia e ainda
    // bem fora do prazo mínimo de cancelamento (5 min) — o que o teste quer provar.
    const startsAt = new Date();
    startsAt.setUTCDate(startsAt.getUTCDate() + 1);
    startsAt.setUTCHours(15, 0, 0, 0);
    const created = await createAppointmentBot(ctx, { contactId: contact.id, serviceId: service.id, professionalId: professional.id, startsAt, idempotencyKey: "ok-cancel-1" });

    const cancelled = await cancelAppointmentBot(ctx, created.appointment.id, contact.id);
    expect(cancelled.status).toBe("CANCELED");
  });
});

describe("PATCH /contacts/{contactId} (§6.5)", () => {
  it("nome válido (2-60 chars) atualiza o contato", async () => {
    const { ctx } = await makeTenantWithInstance("patch-name-ok");
    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: "5511900012001@s.whatsapp.net" } });

    const updated = await updateContactName(ctx.tenantId, contact.id, "Maria Silva");
    expect(updated.name).toBe("Maria Silva");
  });

  it("nome com 1 caractere → INVALID_NAME", async () => {
    const { ctx } = await makeTenantWithInstance("patch-name-short");
    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: "5511900012002@s.whatsapp.net" } });

    await expect(updateContactName(ctx.tenantId, contact.id, "A")).rejects.toMatchObject({ code: "INVALID_NAME" });
  });

  it("nome com 61 caracteres → INVALID_NAME", async () => {
    const { ctx } = await makeTenantWithInstance("patch-name-long");
    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: "5511900012003@s.whatsapp.net" } });

    await expect(updateContactName(ctx.tenantId, contact.id, "x".repeat(61))).rejects.toMatchObject({ code: "INVALID_NAME" });
  });

  it("nome só com espaços (trim reduz abaixo de 2) → INVALID_NAME", async () => {
    const { ctx } = await makeTenantWithInstance("patch-name-blank");
    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: "5511900012004@s.whatsapp.net" } });

    await expect(updateContactName(ctx.tenantId, contact.id, "   ")).rejects.toMatchObject({ code: "INVALID_NAME" });
  });

  it("contactId de outro tenant → NOT_FOUND (isolamento)", async () => {
    const { ctx: ctxA } = await makeTenantWithInstance("patch-name-cross-a");
    const { ctx: ctxB } = await makeTenantWithInstance("patch-name-cross-b");
    const contactB = await prisma.contact.create({ data: { tenantId: ctxB.tenantId, waJid: "5511900012005@s.whatsapp.net" } });

    await expect(updateContactName(ctxA.tenantId, contactB.id, "Nome Qualquer")).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Confirma que NADA mudou no contato do outro tenant.
    const untouched = await prisma.contact.findUniqueOrThrow({ where: { id: contactB.id } });
    expect(untouched.name).toBeNull();
  });
});

describe("POST /connection-events (§6.8)", () => {
  it("state=open → CONNECTED e lastConnectedAt preenchido", async () => {
    const { ctx, instance } = await makeTenantWithInstance("conn-open");
    const result = await applyConnectionEvent(ctx, { event: "connection.update", data: { state: "open" } });
    expect(result).toEqual({ applied: true });

    const row = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instance.id } });
    expect(row.status).toBe("CONNECTED");
    expect(row.lastConnectedAt).not.toBeNull();
  });

  it("state=close → DISCONNECTED", async () => {
    const { ctx, instance } = await makeTenantWithInstance("conn-close");
    const result = await applyConnectionEvent(ctx, { event: "connection.update", data: { state: "close" } });
    expect(result).toEqual({ applied: true });

    const row = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instance.id } });
    expect(row.status).toBe("DISCONNECTED");
  });

  it("state=connecting → QRCODE", async () => {
    const { ctx, instance } = await makeTenantWithInstance("conn-connecting");
    const result = await applyConnectionEvent(ctx, { event: "connection.update", data: { state: "connecting" } });
    expect(result).toEqual({ applied: true });

    const row = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instance.id } });
    expect(row.status).toBe("QRCODE");
  });

  it("payload sem data.state reconhecido → applied:false, sem tocar a instância, e NUNCA lança (sempre 200 pro webhook)", async () => {
    const { ctx, instance } = await makeTenantWithInstance("conn-garbage");
    const before = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instance.id } });

    const resultGarbage = await applyConnectionEvent(ctx, { hello: "world" });
    expect(resultGarbage).toEqual({ applied: false });

    const resultUnknownState = await applyConnectionEvent(ctx, { data: { state: "some-unknown-state" } });
    expect(resultUnknownState).toEqual({ applied: false });

    const resultNull = await applyConnectionEvent(ctx, null);
    expect(resultNull).toEqual({ applied: false });

    const after = await prisma.whatsappInstance.findUniqueOrThrow({ where: { id: instance.id } });
    expect(after.status).toBe(before.status);
  });
});
