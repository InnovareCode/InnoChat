/**
 * Testes de contrato dos 3 buracos corrigidos na Fase 4b (docs/contratos.md — "Fase 4b: API
 * interna do bot: buracos de contrato encontrados ao montar o innochat-bot no n8n"):
 *
 *   1. `GET /contacts/{contactId}/appointments` devolve `serviceId`/`professionalId`/
 *      `servico`/`profissional`/`data`/`hora`/`startsAt` em cada opção, não só `{id,label}`.
 *   2. `tenant.timezone` na resposta `process` do `POST /messages/claim`; `GET
 *      /availability/days` aceita `from` omitido ("hoje no fuso do tenant").
 *   3. Rótulos estruturais (`LABEL_*`) fazem parte do `texts` devolvido pelo claim, com os
 *      valores padrão exatamente iguais ao que o n8n tinha hardcoded.
 *
 * Mesma convenção de `tests/integration/bot-api.integration.test.ts` (chama a lógica de módulo
 * direto, banco `innochat_test` real — ver `.claude/agent-memory/vega/integration_tests_setup.md`).
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { hashInternalApiSecret } from "@/modules/platform/service";
import type { InternalApiContext } from "@/modules/bot-api/internal-auth";
import { claimMessage } from "@/modules/bot-api/claim";
import { createAppointmentBot, listAvailabilityDayOptions, listMyAppointmentOptions } from "@/modules/bot-api/booking-bot";
import { createProfessional, createService, setProfessionalServices, setProfessionalWorkingHours } from "@/modules/agenda/catalog";
import { formatDayLabel, formatTimeLabel } from "@/core/bot/format";

const prisma = getPrisma();
const INTERNAL_SECRET = "test-internal-secret-0123456789";

function evolutionTextPayload(opts: { instance: string; jid: string; id: string; text: string }) {
  return {
    event: "messages.upsert",
    instance: opts.instance,
    data: {
      key: { remoteJid: opts.jid, fromMe: false, id: opts.id },
      pushName: "Cliente Teste",
      message: { conversation: opts.text },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
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
      data: { code: `it-botfix-${Date.now()}-${randomUUID().slice(0, 6)}`, name: "Plano IT bot fix", priceCents: 0, maxWhatsappNumbers: 3, maxProfessionals: null, active: false, sortOrder: 999 },
    });
    botPlanId = plan.id;
  }
  return botPlanId;
}

async function makeTenantWithInstance(label: string, timezone = "UTC") {
  const tenant = await prisma.tenant.create({
    data: {
      slug: `it-botfix-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`,
      name: `Bot Fix ${label}`,
      timezone,
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

describe("Fase 4b.1 — GET /contacts/{contactId}/appointments com dados estruturados", () => {
  it("cada opção vem com serviceId/professionalId/servico/profissional/data/hora/startsAt, além do label de sempre", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("appt-fields", "America/Sao_Paulo");
    const { date: startsAt, weekday } = nextWeekdayAt(5, "14:00");

    const service = await createService(ctx.tenantId, { name: "Corte feminino", durationMin: 30, bufferAfterMin: 0, priceCents: 8000, active: true, sortOrder: 0 });
    const professional = await createProfessional(ctx.tenantId, { name: "Ana", active: true, sortOrder: 0 });
    await setProfessionalServices(ctx.tenantId, professional.id, [service.id]);
    await setProfessionalWorkingHours(ctx.tenantId, professional.id, [{ weekday, startTime: "00:00", endTime: "23:59" }]);

    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: "5511900003001@s.whatsapp.net" } });
    const { appointment } = await createAppointmentBot(ctx, {
      contactId: contact.id,
      serviceId: service.id,
      professionalId: professional.id,
      startsAt,
      idempotencyKey: "fields-1",
    });

    const { options } = await listMyAppointmentOptions(ctx.tenantId, contact.id, true);
    expect(options).toHaveLength(1);
    const option = options[0];

    expect(option.id).toBe(appointment.id);
    expect(option.serviceId).toBe(service.id);
    expect(option.professionalId).toBe(professional.id);
    expect(option.servico).toBe("Corte feminino");
    expect(option.profissional).toBe("Ana");
    expect(option.data).toBe(formatDayLabel(startsAt, "America/Sao_Paulo"));
    expect(option.hora).toBe(formatTimeLabel(startsAt, "America/Sao_Paulo"));
    expect(option.startsAt).toBe(startsAt.toISOString());
    // Compatibilidade: label continua no mesmo formato de antes (quem só lê `label` não quebra).
    expect(option.label).toBe(`${option.data} ${option.hora} — Corte feminino (Ana)`);
  });

  it("cliente sem agendamentos → options vazio (nunca lança)", async () => {
    const { ctx } = await makeTenantWithInstance("appt-empty");
    const contact = await prisma.contact.create({ data: { tenantId: ctx.tenantId, waJid: "5511900003002@s.whatsapp.net" } });
    const { options } = await listMyAppointmentOptions(ctx.tenantId, contact.id, true);
    expect(options).toEqual([]);
  });
});

describe("Fase 4b.2 — tenant.timezone no claim e from omitido em /availability/days", () => {
  it("claim devolve tenant.timezone igual ao Tenant.timezone real", async () => {
    await ensureInternalSecret();
    const { ctx, tenant } = await makeTenantWithInstance("claim-tz", "America/Sao_Paulo");
    const payload = evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900004001@s.whatsapp.net", id: "tz-1", text: "oi" });

    const result = await claimMessage(ctx, payload);
    expect(result.action).toBe("process");
    if (result.action !== "process") throw new Error("esperava process");
    expect(result.tenant.timezone).toBe(tenant.timezone);
    expect(result.tenant.timezone).toBe("America/Sao_Paulo");
  });

  it("/availability/days sem `from` usa hoje no fuso do tenant (mesmo resultado que passar from explícito)", async () => {
    const { ctx } = await makeTenantWithInstance("days-default-from", "America/Sao_Paulo");
    const { date: startsAt, weekday } = nextWeekdayAt(5, "14:00");

    const service = await createService(ctx.tenantId, { name: "Corte", durationMin: 30, bufferAfterMin: 0, priceCents: null, active: true, sortOrder: 0 });
    const professional = await createProfessional(ctx.tenantId, { name: "Bia", active: true, sortOrder: 0 });
    await setProfessionalServices(ctx.tenantId, professional.id, [service.id]);
    await setProfessionalWorkingHours(ctx.tenantId, professional.id, [{ weekday, startTime: "00:00", endTime: "23:59" }]);
    void startsAt;

    const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

    const withoutFrom = await listAvailabilityDayOptions(ctx.tenantId, { serviceId: service.id, professionalId: professional.id, from: null, limit: 7 });
    const withExplicitFrom = await listAvailabilityDayOptions(ctx.tenantId, { serviceId: service.id, professionalId: professional.id, from: todayISO, limit: 7 });

    expect(withoutFrom.options).toEqual(withExplicitFrom.options);
  });
});

describe("Fase 4b.3 — rótulos estruturais (LABEL_*) no texts do claim", () => {
  it("texts do claim inclui as 8 chaves LABEL_* com os defaults pt-BR do n8n", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("labels-default");
    const payload = evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900005001@s.whatsapp.net", id: "label-1", text: "oi" });

    const result = await claimMessage(ctx, payload);
    expect(result.action).toBe("process");
    if (result.action !== "process") throw new Error("esperava process");

    expect(result.texts.LABEL_CONFIRM).toBe("Confirmar");
    expect(result.texts.LABEL_OTHER_TIME).toBe("Escolher outro horário");
    expect(result.texts.LABEL_CANCEL_YES).toBe("Sim, cancelar");
    expect(result.texts.LABEL_CANCEL_NO).toBe("Não, manter");
    expect(result.texts.LABEL_MORE_DAYS).toBe("Ver mais datas");
    expect(result.texts.LABEL_MORE_TIMES).toBe("Mais horários");
    expect(result.texts.LABEL_MORE).toBe("Ver mais");
    expect(result.texts.LABEL_BACK_TO_MENU).toBe("0. Menu principal");
  });

  it("tenant edita LABEL_CONFIRM via BotText e o claim devolve a edição, não o default", async () => {
    await ensureInternalSecret();
    const { ctx } = await makeTenantWithInstance("labels-override");
    await prisma.botText.create({ data: { tenantId: ctx.tenantId, key: "LABEL_CONFIRM", text: "Confirmar agendamento" } });

    const payload = evolutionTextPayload({ instance: ctx.instance.instanceName, jid: "5511900005002@s.whatsapp.net", id: "label-2", text: "oi" });
    const result = await claimMessage(ctx, payload);
    expect(result.action).toBe("process");
    if (result.action !== "process") throw new Error("esperava process");

    expect(result.texts.LABEL_CONFIRM).toBe("Confirmar agendamento");
    expect(result.texts.LABEL_OTHER_TIME).toBe("Escolher outro horário"); // as demais continuam no default
  });
});
