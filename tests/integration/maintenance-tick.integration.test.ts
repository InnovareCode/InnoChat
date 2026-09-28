/**
 * `runMaintenanceTick` (docs/contratos.md — "Segurança") contra Postgres real: purga
 * `InboundEvent` > 30 dias e anonimiza `Contact` de tenants `CANCELED` há mais de 90 dias
 * (docs/arquitetura.md §11/§12 — política declarada, implementada nesta rodada, revisão de
 * segurança 2026-09-28 achado MÉDIA).
 */
import { randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";

const { runMaintenanceTick } = await import("@/modules/maintenance/tick");

const prisma = getPrisma();
const cleanupTenantIds: string[] = [];
const cleanupInstanceIds: string[] = [];

afterAll(async () => {
  await prisma.whatsappInstance.deleteMany({ where: { id: { in: cleanupInstanceIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: cleanupTenantIds } } });
  await prisma.$disconnect();
});

async function makeTenantWithPlanAndSubscription(label: string, subscriptionOverrides: Partial<{ status: "TRIALING" | "ACTIVE" | "CANCELED"; canceledAt: Date | null }> = {}) {
  const slug = `it-maint-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const tenant = await prisma.tenant.create({ data: { slug, name: `Maint ${label}`, timezone: "UTC" } });
  const plan = await prisma.plan.create({
    data: { code: `${slug}-plan`, name: "Plano IT", priceCents: 4990, maxWhatsappNumbers: 1, maxProfessionals: 1, active: false, sortOrder: 999 },
  });
  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: subscriptionOverrides.status ?? "ACTIVE",
      currentPeriodEnd: addDays(new Date(), 30),
      canceledAt: subscriptionOverrides.canceledAt,
    },
  });
  return { tenant, plan };
}

async function makeWhatsappInstance(tenantId: string, label: string) {
  const instance = await prisma.whatsappInstance.create({
    data: { tenantId, instanceName: `it-maint-${label}-${Date.now()}`, label: "Principal", status: "CONNECTED", webhookToken: randomUUID() },
  });
  cleanupInstanceIds.push(instance.id);
  return instance;
}

describe("runMaintenanceTick — purga InboundEvent > 30 dias", () => {
  it("apaga eventos com mais de 30 dias, mantém os mais recentes", async () => {
    const { tenant } = await makeTenantWithPlanAndSubscription("purge");
    cleanupTenantIds.push(tenant.id);
    const instance = await makeWhatsappInstance(tenant.id, "purge");

    const old = await prisma.inboundEvent.create({
      data: { whatsappInstanceId: instance.id, providerMessageId: `old-${randomUUID()}`, outcome: "IGNORE", reason: "STALE" },
    });
    await prisma.inboundEvent.update({ where: { id: old.id }, data: { createdAt: addDays(new Date(), -31) } });

    const recent = await prisma.inboundEvent.create({
      data: { whatsappInstanceId: instance.id, providerMessageId: `recent-${randomUUID()}`, outcome: "IGNORE", reason: "STALE" },
    });

    const summary = await runMaintenanceTick(new Date());
    expect(summary.inboundEventsPurged).toBeGreaterThanOrEqual(1);

    expect(await prisma.inboundEvent.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.inboundEvent.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });

  it("idempotente: rodar 2x seguidas na segunda não apaga nada de novo", async () => {
    const { tenant } = await makeTenantWithPlanAndSubscription("purge-idem");
    cleanupTenantIds.push(tenant.id);
    const instance = await makeWhatsappInstance(tenant.id, "purge-idem");

    const old = await prisma.inboundEvent.create({
      data: { whatsappInstanceId: instance.id, providerMessageId: `old-idem-${randomUUID()}`, outcome: "IGNORE", reason: "STALE" },
    });
    await prisma.inboundEvent.update({ where: { id: old.id }, data: { createdAt: addDays(new Date(), -40) } });

    const first = await runMaintenanceTick(new Date());
    expect(first.inboundEventsPurged).toBeGreaterThanOrEqual(1);

    const second = await runMaintenanceTick(new Date());
    expect(second.inboundEventsPurged).toBe(0);
  });
});

describe("runMaintenanceTick — anonimização de Contact (CANCELED > 90 dias)", () => {
  it("anonimiza contato de tenant CANCELED há mais de 90 dias, preserva o vínculo (id mantido)", async () => {
    const { tenant } = await makeTenantWithPlanAndSubscription("anon", { status: "CANCELED", canceledAt: addDays(new Date(), -100) });
    cleanupTenantIds.push(tenant.id);

    const contact = await prisma.contact.create({
      data: { tenantId: tenant.id, waJid: `5511999999999@s.whatsapp.net`, phoneE164: "+5511999999999", name: "Cliente Real", pushName: "Cliente" },
    });

    const summary = await runMaintenanceTick(new Date());
    expect(summary.contactsAnonymized).toBe(1);

    const reloaded = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(reloaded.name).toBeNull();
    expect(reloaded.pushName).toBeNull();
    expect(reloaded.phoneE164).toBeNull();
    expect(reloaded.waJid).toBe(`anon:${contact.id}`);
  });

  it("NÃO anonimiza contato de tenant CANCELED há menos de 90 dias", async () => {
    const { tenant } = await makeTenantWithPlanAndSubscription("anon-recent", { status: "CANCELED", canceledAt: addDays(new Date(), -10) });
    cleanupTenantIds.push(tenant.id);

    const contact = await prisma.contact.create({
      data: { tenantId: tenant.id, waJid: `5511988888888@s.whatsapp.net`, name: "Ainda Dentro Do Prazo" },
    });

    const summary = await runMaintenanceTick(new Date());
    expect(summary.contactsAnonymized).toBe(0);

    const reloaded = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(reloaded.name).toBe("Ainda Dentro Do Prazo");
  });

  it("NÃO anonimiza contato de tenant ACTIVE (nunca cancelado)", async () => {
    const { tenant } = await makeTenantWithPlanAndSubscription("anon-active");
    cleanupTenantIds.push(tenant.id);

    const contact = await prisma.contact.create({
      data: { tenantId: tenant.id, waJid: `5511977777777@s.whatsapp.net`, name: "Cliente Ativo" },
    });

    const summary = await runMaintenanceTick(new Date());
    expect(summary.contactsAnonymized).toBe(0);

    const reloaded = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(reloaded.name).toBe("Cliente Ativo");
  });

  it("idempotente: rodar 2x seguidas na segunda não conta o mesmo contato de novo", async () => {
    const { tenant } = await makeTenantWithPlanAndSubscription("anon-idem", { status: "CANCELED", canceledAt: addDays(new Date(), -95) });
    cleanupTenantIds.push(tenant.id);

    await prisma.contact.create({ data: { tenantId: tenant.id, waJid: `5511966666666@s.whatsapp.net`, name: "Repetido" } });

    const first = await runMaintenanceTick(new Date());
    expect(first.contactsAnonymized).toBe(1);

    const second = await runMaintenanceTick(new Date());
    expect(second.contactsAnonymized).toBe(0);
  });
});
