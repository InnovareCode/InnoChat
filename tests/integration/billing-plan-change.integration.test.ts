/**
 * `changePlan` (docs/arquitetura.md §7.2, src/modules/billing/service.ts) contra Postgres real:
 * upgrade aplica na hora; downgrade só entra em `pendingPlanId` se o uso atual couber no plano
 * novo, e só vira `planId` de verdade quando `billing/tick` fatura o próximo ciclo (ou quando
 * um pagamento é aplicado antes disso, como rede de segurança).
 */
import { randomUUID } from "node:crypto";
import { addDays, addMonths } from "date-fns";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return { ...actual, sendMail: vi.fn(async () => ({ sent: true })) };
});

const { changePlan } = await import("@/modules/billing/service");
const { runBillingTick } = await import("@/modules/billing/tick");
const { applyInvoicePayment } = await import("@/modules/billing/service");
const { createMockMercadoPagoGateway } = await import("@/modules/billing/mercadopago.mock");
const { createProfessional } = await import("@/modules/agenda/catalog");

const prisma = getPrisma();
const cleanupTenantIds: string[] = [];
const cleanupPlanIds: string[] = [];
const cleanupUserIds: string[] = [];

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: cleanupTenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.plan.deleteMany({ where: { id: { in: cleanupPlanIds } } });
  await prisma.$disconnect();
});

async function makePlans(label: string) {
  const suffix = `${label}-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const [small, big] = await Promise.all([
    prisma.plan.create({
      data: { code: `it-small-${suffix}`, name: "Pequeno", priceCents: 1000, maxWhatsappNumbers: 1, maxProfessionals: 1, active: true, sortOrder: 1 },
    }),
    prisma.plan.create({
      data: { code: `it-big-${suffix}`, name: "Grande", priceCents: 5000, maxWhatsappNumbers: 5, maxProfessionals: 10, active: true, sortOrder: 2 },
    }),
  ]);
  cleanupPlanIds.push(small.id, big.id);
  return { small, big };
}

async function makeTenantOnPlan(label: string, planId: string) {
  const slug = `it-plan-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const tenant = await prisma.tenant.create({ data: { slug, name: `Plan ${label}`, timezone: "UTC" } });
  cleanupTenantIds.push(tenant.id);
  // OWNER com e-mail — `billing/tick` (findBillingRecipientEmail) pula qualquer tenant sem um
  // membro OWNER com e-mail, então o teste de downgrade-no-tick precisa disto para não ficar
  // silenciosamente pulado.
  const owner = await prisma.user.create({ data: { email: `${slug}@example.com`, passwordHash: "x", emailVerifiedAt: new Date() } });
  cleanupUserIds.push(owner.id);
  await prisma.membership.create({ data: { userId: owner.id, tenantId: tenant.id, role: "OWNER" } });
  const now = new Date();
  await prisma.subscription.create({
    data: { tenantId: tenant.id, planId, status: "ACTIVE", currentPeriodEnd: addMonths(now, 1) },
  });
  return tenant;
}

describe("changePlan — troca de plano pelo OWNER (§7.2)", () => {
  it("upgrade aplica na hora (planId trocado já)", async () => {
    const { small, big } = await makePlans("upgrade");
    const tenant = await makeTenantOnPlan("upgrade", small.id);

    const result = await changePlan(tenant.id, big.id);
    expect(result.appliedImmediately).toBe(true);

    const subscription = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    expect(subscription?.planId).toBe(big.id);
    expect(subscription?.pendingPlanId).toBeNull();
  });

  it("downgrade sem uso excedente vira pendingPlanId (não muda planId na hora)", async () => {
    const { small, big } = await makePlans("downgrade-ok");
    const tenant = await makeTenantOnPlan("downgrade-ok", big.id);

    const result = await changePlan(tenant.id, small.id);
    expect(result.appliedImmediately).toBe(false);

    const subscription = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    expect(subscription?.planId).toBe(big.id); // ainda no plano atual
    expect(subscription?.pendingPlanId).toBe(small.id);
  });

  it("downgrade bloqueado quando o uso atual não cabe no plano novo (PLAN_DOWNGRADE_BLOCKED)", async () => {
    const { small, big } = await makePlans("downgrade-blocked");
    const tenant = await makeTenantOnPlan("downgrade-blocked", big.id);

    // Plano pequeno permite só 1 profissional — crio 2 no plano grande atual.
    await createProfessional(tenant.id, { name: "Profissional A", active: true, sortOrder: 1 });
    await createProfessional(tenant.id, { name: "Profissional B", active: true, sortOrder: 2 });

    await expect(changePlan(tenant.id, small.id)).rejects.toMatchObject({
      code: "PLAN_DOWNGRADE_BLOCKED",
      details: expect.objectContaining({ rule: "maxProfessionals", limit: 1, current: 2 }),
    });

    const subscription = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    expect(subscription?.pendingPlanId).toBeNull(); // nunca chegou a gravar
  });

  it("downgrade pendente entra em vigor quando billing/tick fatura o próximo ciclo (preço já é o do plano novo)", async () => {
    const { small, big } = await makePlans("downgrade-tick");
    const tenant = await makeTenantOnPlan("downgrade-tick", big.id);
    await changePlan(tenant.id, small.id);

    // Empurra o ciclo para dentro da janela de 5 dias do tick, como billing-tick.integration.test.ts faz.
    const now = new Date();
    await prisma.subscription.update({ where: { tenantId: tenant.id }, data: { currentPeriodEnd: addDays(now, 2) } });

    const { gateway } = createMockMercadoPagoGateway();
    await runBillingTick(now, gateway);

    const subscription = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    expect(subscription?.planId).toBe(small.id);
    expect(subscription?.pendingPlanId).toBeNull();

    const invoice = await prisma.invoice.findFirst({ where: { subscriptionId: subscription!.id }, orderBy: { periodStart: "desc" } });
    expect(invoice?.amountCents).toBe(small.priceCents);
  });

  it("applyInvoicePayment também aplica o downgrade pendente (rede de segurança)", async () => {
    const { small, big } = await makePlans("downgrade-payment");
    const tenant = await makeTenantOnPlan("downgrade-payment", big.id);
    await changePlan(tenant.id, small.id);

    const subscription = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: subscription!.id,
        amountCents: big.priceCents,
        periodStart: new Date(),
        periodEnd: addMonths(new Date(), 1),
        dueAt: new Date(),
        status: "OPEN",
      },
    });

    await applyInvoicePayment(invoice.id, new Date());

    const updated = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    expect(updated?.planId).toBe(small.id);
    expect(updated?.pendingPlanId).toBeNull();
  });

  it("rejeita trocar para o mesmo plano sem downgrade pendente (INVALID_STATE)", async () => {
    const { small } = await makePlans("same-plan");
    const tenant = await makeTenantOnPlan("same-plan", small.id);

    await expect(changePlan(tenant.id, small.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
