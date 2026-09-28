/**
 * Testes de contrato da API interna do bot (docs/arquitetura.md §6.1–6.5, §8) contra Postgres
 * real. Mesma convenção de `tests/integration/agenda.integration.test.ts`: chama a lógica de
 * módulo direto (sem passar pela camada HTTP do Next) — o que importa aqui é ISOLAMENTO,
 * DEDUPE e CONCORRÊNCIA reais, que só o banco de verdade prova.
 *
 * Requer `TEST_DATABASE_URL` com as migrations aplicadas (ver PARA O PRÓXIMO no handoff da Vega
 * / `.claude/agent-memory/vega/integration_tests_setup.md`).
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { hashInternalApiSecret } from "@/modules/platform/service";
import { resolveInternalRequest, type InternalApiContext } from "@/modules/bot-api/internal-auth";
import { claimMessage } from "@/modules/bot-api/claim";
import { updateSession } from "@/modules/bot-api/session";
import { createAppointmentBot } from "@/modules/bot-api/booking-bot";
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

/** O claim bloqueia empresa sem assinatura válida (subscription-gate), então toda empresa de teste nasce ACTIVE. */
async function getBotPlanId() {
  if (!botPlanId) {
    const plan = await prisma.plan.create({
      data: { code: `it-bot-${Date.now()}-${randomUUID().slice(0, 6)}`, name: "Plano IT bot", priceCents: 0, maxWhatsappNumbers: 3, maxProfessionals: null, active: false, sortOrder: 999 },
    });
    botPlanId = plan.id;
  }
  return botPlanId;
}

async function makeTenantWithInstance(label: string, sandbox = false) {
  const tenant = await prisma.tenant.create({
    data: {
      slug: `it-bot-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`,
      name: `Bot Integração ${label}`,
      timezone: "UTC",
      minLeadTimeMin: 0,
      maxHorizonDays: 60,
    },
  });
  createdTenantIds.push(tenant.id);
  await prisma.subscription.create({
    data: { tenantId: tenant.id, planId: await getBotPlanId(), status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
  });

  const instance = await prisma.whatsappInstance.create({
    data: {
      tenantId: tenant.id,
      instanceName: `innochat-${label}-${randomUUID().slice(0, 6)}`,
      label: "Principal",
      webhookToken: randomUUID(),
      sandbox,
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

describe("autenticação da API interna (§6.1)", () => {
  it("sem Authorization → 401", async () => {
    await ensureInternalSecret();
    const req = new Request("http://localhost/api/internal/v1/catalog/services");
    await expect(resolveInternalRequest(req)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("segredo errado → 401", async () => {
    await ensureInternalSecret();
    const req = new Request("http://localhost/api/internal/v1/catalog/services", {
      headers: { authorization: "Bearer segredo-errado", "x-innochat-instance": "qualquer" },
    });
    await expect(resolveInternalRequest(req)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("segredo certo mas sem X-InnoChat-Instance → 401", async () => {
    await ensureInternalSecret();
    const req = new Request("http://localhost/api/internal/v1/catalog/services", {
      headers: { authorization: `Bearer ${INTERNAL_SECRET}` },
    });
    await expect(resolveInternalRequest(req)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("token de instância inexistente → 401", async () => {
    await ensureInternalSecret();
    const req = new Request("http://localhost/api/internal/v1/catalog/services", {
      headers: { authorization: `Bearer ${INTERNAL_SECRET}`, "x-innochat-instance": "token-que-nao-existe" },
    });
    await expect(resolveInternalRequest(req)).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("Bearer + X-InnoChat-Instance corretos resolvem o tenant certo", async () => {
    await ensureInternalSecret();
    const { tenant, instance } = await makeTenantWithInstance("auth-ok");
    const req = new Request("http://localhost/api/internal/v1/catalog/services", {
      headers: { authorization: `Bearer ${INTERNAL_SECRET}`, "x-innochat-instance": instance.webhookToken },
    });
    const ctx = await resolveInternalRequest(req);
    expect(ctx.tenantId).toBe(tenant.id);
    expect(ctx.instance.instanceName).toBe(instance.instanceName);
  });
});

describe("POST /messages/claim (§6.2)", () => {
  it("evento lixo/irreconhecível nunca lança — sempre ignore", async () => {
    const { ctx } = await makeTenantWithInstance("garbage");
    const result = await claimMessage(ctx, { hello: "world" });
    expect(result).toEqual({ action: "ignore", reason: "UNSUPPORTED_EVENT" });
  });

  it("dedupe: o mesmo providerMessageId processado 2x devolve DUPLICATE na segunda", async () => {
    const { ctx } = await makeTenantWithInstance("dedupe");
    const payload = evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900000001@s.whatsapp.net", id: "dup-1", text: "oi" });

    const first = await claimMessage(ctx, payload);
    expect(first.action).toBe("process");

    const second = await claimMessage(ctx, payload);
    expect(second).toEqual({ action: "ignore", reason: "DUPLICATE" });

    const events = await prisma.inboundEvent.findMany({ where: { whatsappInstanceId: ctx.instance.id, providerMessageId: "dup-1" } });
    expect(events).toHaveLength(1); // unique constraint garante isso mesmo sob corrida
  });

  it("claim concorrente do mesmo contato: uma execução recebe busy", async () => {
    const { ctx } = await makeTenantWithInstance("busy");
    const jid = "5511900000002@s.whatsapp.net";

    const [a, b] = await Promise.all([
      claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "concurrent-a", text: "1" })),
      claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid, id: "concurrent-b", text: "2" })),
    ]);

    const actions = [a.action, b.action].sort();
    expect(actions).toEqual(["busy", "process"]);
  });

  it("isolamento: instâncias de tenants diferentes nunca compartilham sessão/dedupe", async () => {
    const { ctx: ctxA } = await makeTenantWithInstance("iso-a");
    const { ctx: ctxB } = await makeTenantWithInstance("iso-b");
    const jid = "5511900000003@s.whatsapp.net";

    const resultA = await claimMessage(ctxA, evolutionTextPayload({ instance: ctxA.instance.instanceName, jid, id: "iso-msg", text: "oi" }));
    const resultB = await claimMessage(ctxB, evolutionTextPayload({ instance: ctxB.instance.instanceName, jid, id: "iso-msg", text: "oi" }));

    // Mesmo JID, mesmo providerMessageId — mas tenants diferentes: as duas processam (não é
    // dedupe cruzado), e cada uma cria seu PRÓPRIO Contact/ChatSession.
    expect(resultA.action).toBe("process");
    expect(resultB.action).toBe("process");

    const contactsA = await prisma.contact.findMany({ where: { tenantId: ctxA.tenantId, waJid: jid } });
    const contactsB = await prisma.contact.findMany({ where: { tenantId: ctxB.tenantId, waJid: jid } });
    expect(contactsA).toHaveLength(1);
    expect(contactsB).toHaveLength(1);
    expect(contactsA[0].id).not.toBe(contactsB[0].id);
  });

  it("@lid sem alternativa e sem Contact.lid conhecido → UNRESOLVABLE_SENDER", async () => {
    const { ctx } = await makeTenantWithInstance("unresolvable");
    const payload = {
      event: "messages.upsert",
      instance: ctx.instance.instanceName,
      data: {
        key: { remoteJid: "999999999999@lid", fromMe: false, id: "lid-msg-1" },
        pushName: "Desconhecido",
        message: { conversation: "oi" },
        messageType: "conversation",
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };
    const result = await claimMessage(ctx, payload);
    expect(result).toEqual({ action: "ignore", reason: "UNRESOLVABLE_SENDER" });
  });
});

describe("PUT /sessions/{id} — trava vencida (§6.3)", () => {
  it("lockedUntil no passado → LOCK_LOST", async () => {
    const { ctx } = await makeTenantWithInstance("lock-lost");
    const claimed = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900000004@s.whatsapp.net", id: "lock-1", text: "1" }));
    if (claimed.action !== "process") throw new Error("esperava process");

    // Simula a trava vencida (20s se passaram de verdade, sem precisar esperar).
    await prisma.chatSession.update({ where: { id: claimed.session.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });

    await expect(
      updateSession(ctx, claimed.session.id, {
        lockToken: claimed.session.lockToken,
        version: claimed.session.version,
        state: "MAIN_MENU",
        context: {},
        invalidCount: 0,
        outbound: ["oi"],
        handoff: false,
      }),
    ).rejects.toMatchObject({ code: "LOCK_LOST" });
  });

  it("version divergente → LOCK_LOST", async () => {
    const { ctx } = await makeTenantWithInstance("lock-version");
    const claimed = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900000005@s.whatsapp.net", id: "lock-2", text: "1" }));
    if (claimed.action !== "process") throw new Error("esperava process");

    await expect(
      updateSession(ctx, claimed.session.id, {
        lockToken: claimed.session.lockToken,
        version: claimed.session.version + 1, // versão errada de propósito
        state: "MAIN_MENU",
        context: {},
        invalidCount: 0,
        outbound: [],
        handoff: false,
      }),
    ).rejects.toMatchObject({ code: "LOCK_LOST" });
  });

  it("lockToken/version corretos: grava e libera a trava", async () => {
    const { ctx } = await makeTenantWithInstance("lock-ok");
    const claimed = await claimMessage(ctx, evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900000006@s.whatsapp.net", id: "lock-3", text: "1" }));
    if (claimed.action !== "process") throw new Error("esperava process");

    const result = await updateSession(ctx, claimed.session.id, {
      lockToken: claimed.session.lockToken,
      version: claimed.session.version,
      state: "SELECT_SERVICE",
      context: { foo: "bar" },
      invalidCount: 0,
      outbound: ["Escolha um serviço:"],
      handoff: false,
    });
    expect(result.version).toBe(claimed.session.version + 1);

    const row = await prisma.chatSession.findUniqueOrThrow({ where: { id: claimed.session.id } });
    expect(row.lockToken).toBeNull();
    expect(row.lockedUntil).toBeNull();
    expect(row.state).toBe("SELECT_SERVICE");
  });
});

describe("POST /appointments (bot) — concorrência e idempotência (§2 regra 3/4, §8)", () => {
  async function setupBookable(label: string) {
    const { ctx } = await makeTenantWithInstance(label);
    const { date: startsAt, weekday } = nextWeekdayAt(5, "14:00");
    const service = await createService(ctx.tenantId, { name: "Corte", durationMin: 30, bufferAfterMin: 0, priceCents: 8000, active: true, sortOrder: 0 });
    const professional = await createProfessional(ctx.tenantId, { name: "Ana", active: true, sortOrder: 0 });
    await setProfessionalServices(ctx.tenantId, professional.id, [service.id]);
    await setProfessionalWorkingHours(ctx.tenantId, professional.id, [{ weekday, startTime: "00:00", endTime: "23:59" }]);
    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: `5511900001000@s.whatsapp.net` } });
    return { ctx, service, professional, contact, startsAt };
  }

  it("20 chamadas paralelas para o mesmo horário: exatamente 1 sucesso, 19 SLOT_TAKEN com alternativas", async () => {
    const { ctx, service, professional, startsAt } = await setupBookable("concurrency");

    const attempts = Array.from({ length: 20 }, async (_, i) => {
      const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: `5511900002${String(i).padStart(3, "0")}@s.whatsapp.net` } });
      return createAppointmentBot(ctx, {
        contactId: contact.id,
        serviceId: service.id,
        professionalId: professional.id,
        startsAt,
        idempotencyKey: `bot-concurrency-${i}`,
      });
    });

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof createAppointmentBot>>>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled.filter((r) => !r.value.alreadyExisted)).toHaveLength(1);
    expect(rejected).toHaveLength(19);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(DomainError);
      expect((r.reason as DomainError).code).toBe("SLOT_TAKEN");
      const details = (r.reason as DomainError).details as { alternatives: { date: string; options: unknown[] } };
      expect(details.alternatives).toHaveProperty("date");
      expect(details.alternatives).toHaveProperty("options");
    }
  }, 30_000);

  it("idempotência: mesma idempotencyKey não duplica e devolve o agendamento existente", async () => {
    const { ctx, service, professional, contact, startsAt } = await setupBookable("idempotency");
    const input = { contactId: contact.id, serviceId: service.id, professionalId: professional.id, startsAt, idempotencyKey: "bot-idem-1" };

    const first = await createAppointmentBot(ctx, input);
    const second = await createAppointmentBot(ctx, input);

    expect(first.alreadyExisted).toBe(false);
    expect(second.alreadyExisted).toBe(true);
    expect(second.appointment.id).toBe(first.appointment.id);

    const count = await prisma.appointment.count({ where: { contactId: contact.id } });
    expect(count).toBe(1);
  });

  it("contactId de outro tenant → NOT_FOUND (nunca agenda cross-tenant)", async () => {
    const { ctx: ctxA, service, professional, startsAt } = await setupBookable("cross-a");
    const { contact: contactB } = await setupBookable("cross-b");

    await expect(
      createAppointmentBot(ctxA, { contactId: contactB.id, serviceId: service.id, professionalId: professional.id, startsAt, idempotencyKey: "cross-1" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
