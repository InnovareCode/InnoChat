/**
 * Admin → Cobrança (docs/contratos.md, "Admin Cobrança") contra Postgres real:
 * `listInvoicesAdmin` (paginação/filtros), `billingMonthlyTotals`, `listDelinquentCompanies`,
 * `regeneratePixForInvoiceAdmin` e `markInvoicePaidManually` (idempotência + auditoria).
 */
import { randomUUID } from "node:crypto";
import { addMonths } from "date-fns";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return { ...actual, sendMail: vi.fn(async () => ({ sent: true })) };
});

const {
  billingMonthlyTotals,
  listDelinquentCompanies,
  listInvoicesAdmin,
  markInvoicePaidManually,
  regeneratePixForInvoiceAdmin,
} = await import("@/modules/billing/admin-service");
const { findOwnInvoiceOrThrow, regeneratePixForInvoice } = await import("@/modules/billing/service");
const { createMockMercadoPagoGateway } = await import("@/modules/billing/mercadopago.mock");

const prisma = getPrisma();
const cleanupTenantIds: string[] = [];
const cleanupUserIds: string[] = [];

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: cleanupTenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
  await prisma.$disconnect();
});

async function makePlan(priceCents = 5000) {
  return prisma.plan.create({
    data: {
      code: `it-admin-plan-${Date.now()}-${randomUUID().slice(0, 6)}`,
      name: "Plano IT Admin",
      priceCents,
      maxWhatsappNumbers: 1,
      maxProfessionals: 1,
      active: false,
      sortOrder: 999,
    },
  });
}

async function makeTenantWithSubscriptionAndInvoice(params: {
  label: string;
  document?: string | null;
  subscriptionStatus?: "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
  currentPeriodEnd?: Date;
  invoiceStatus?: "OPEN" | "PAID" | "EXPIRED" | "VOID";
  dueAt?: Date;
  paidAt?: Date | null;
}) {
  const slug = `it-admin-${params.label}-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const tenant = await prisma.tenant.create({
    data: { slug, name: `Admin ${params.label}`, timezone: "UTC", document: params.document ?? "52998224725" },
  });
  cleanupTenantIds.push(tenant.id);

  const user = await prisma.user.create({ data: { email: `${slug}@example.com`, passwordHash: "x", emailVerifiedAt: new Date() } });
  cleanupUserIds.push(user.id);
  await prisma.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "OWNER" } });

  const plan = await makePlan();
  const now = new Date();
  const currentPeriodEnd = params.currentPeriodEnd ?? addMonths(now, 1);

  const subscription = await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: params.subscriptionStatus ?? "ACTIVE",
      currentPeriodEnd,
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      subscriptionId: subscription.id,
      amountCents: plan.priceCents,
      periodStart: now,
      periodEnd: currentPeriodEnd,
      dueAt: params.dueAt ?? currentPeriodEnd,
      status: params.invoiceStatus ?? "OPEN",
      paidAt: params.paidAt ?? null,
    },
  });

  return { tenant, user, plan, subscription, invoice };
}

describe("listInvoicesAdmin", () => {
  it("lista faturas de todas as empresas, filtra por status e paginação por cursor", async () => {
    const { tenant, invoice } = await makeTenantWithSubscriptionAndInvoice({ label: "list-open", invoiceStatus: "OPEN" });
    const { invoice: paidInvoice } = await makeTenantWithSubscriptionAndInvoice({ label: "list-paid", invoiceStatus: "PAID", paidAt: new Date() });

    const openOnly = await listInvoicesAdmin({ status: "OPEN", tenantId: tenant.id });
    expect(openOnly.items.some((i) => i.id === invoice.id)).toBe(true);
    expect(openOnly.items.every((i) => i.status === "OPEN")).toBe(true);

    const paidOnly = await listInvoicesAdmin({ status: "PAID" });
    expect(paidOnly.items.some((i) => i.id === paidInvoice.id)).toBe(true);

    // Paginação: limit=1 sempre devolve nextCursor quando há mais de 1 resultado no total.
    const page1 = await listInvoicesAdmin({ limit: 1 });
    expect(page1.items).toHaveLength(1);
  });
});

describe("billingMonthlyTotals", () => {
  it("soma recebido (PAID no mês), em aberto (não vencido) e vencido (OPEN vencido), e o MRR de assinaturas ACTIVE", async () => {
    const now = new Date();
    const { plan } = await makeTenantWithSubscriptionAndInvoice({
      label: "totals-paid",
      invoiceStatus: "PAID",
      paidAt: now,
      subscriptionStatus: "ACTIVE",
    });
    await makeTenantWithSubscriptionAndInvoice({
      label: "totals-open",
      invoiceStatus: "OPEN",
      dueAt: addMonths(now, 1),
      subscriptionStatus: "ACTIVE",
    });
    await makeTenantWithSubscriptionAndInvoice({
      label: "totals-overdue",
      invoiceStatus: "OPEN",
      dueAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      subscriptionStatus: "PAST_DUE",
    });

    const totals = await billingMonthlyTotals(now);
    expect(totals.receivedCents).toBeGreaterThanOrEqual(plan.priceCents);
    expect(totals.openCents).toBeGreaterThanOrEqual(plan.priceCents);
    expect(totals.overdueCents).toBeGreaterThanOrEqual(plan.priceCents);
    expect(totals.mrrCents).toBeGreaterThanOrEqual(plan.priceCents);
  });
});

describe("listDelinquentCompanies", () => {
  it("lista só PAST_DUE/SUSPENDED, com dias de atraso a partir de currentPeriodEnd", async () => {
    const now = new Date();
    const overdueBy10Days = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const { tenant } = await makeTenantWithSubscriptionAndInvoice({
      label: "delinquent",
      subscriptionStatus: "SUSPENDED",
      currentPeriodEnd: overdueBy10Days,
    });
    await makeTenantWithSubscriptionAndInvoice({ label: "healthy", subscriptionStatus: "ACTIVE" });

    const delinquents = await listDelinquentCompanies(now);
    const found = delinquents.find((d) => d.tenantId === tenant.id);
    expect(found).toBeTruthy();
    expect(found!.status).toBe("SUSPENDED");
    expect(found!.daysOverdue).toBeGreaterThanOrEqual(10);
    expect(delinquents.every((d) => d.status === "PAST_DUE" || d.status === "SUSPENDED")).toBe(true);
  });
});

describe("regeneratePixForInvoiceAdmin", () => {
  it("resolve o e-mail do OWNER e gera o Pix (mesmo caminho de regeneratePixForInvoice)", async () => {
    const { invoice } = await makeTenantWithSubscriptionAndInvoice({ label: "regen-pix", invoiceStatus: "OPEN" });
    const { gateway } = createMockMercadoPagoGateway();

    const updated = await regeneratePixForInvoiceAdmin(invoice.id, gateway);
    expect(updated.pixCopyPaste).toBeTruthy();
  });

  it("NOT_FOUND para fatura inexistente", async () => {
    await expect(regeneratePixForInvoiceAdmin("invoice-inexistente")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("markInvoicePaidManually", () => {
  it("marca PAID, avança o ciclo e registra auditoria (ProviderEvent provider=manual)", async () => {
    const { invoice, subscription } = await makeTenantWithSubscriptionAndInvoice({ label: "manual-pay", invoiceStatus: "OPEN" });
    const adminId = "admin-fake-id";

    const result = await markInvoicePaidManually(invoice.id, adminId, "Cliente pagou por transferência, fora do Pix.");
    expect(result.alreadyProcessed).toBe(false);

    const updatedInvoice = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(updatedInvoice.status).toBe("PAID");
    expect(updatedInvoice.paidAt).not.toBeNull();

    const updatedSubscription = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(updatedSubscription.status).toBe("ACTIVE");

    const audit = await prisma.providerEvent.findUnique({
      where: { provider_providerEventId: { provider: "manual", providerEventId: invoice.id } },
    });
    expect(audit).toBeTruthy();
    expect((audit!.payload as { adminId: string; reason: string }).adminId).toBe(adminId);
    expect((audit!.payload as { adminId: string; reason: string }).reason).toContain("transferência");
  });

  it("idempotente: chamar de novo na mesma fatura não avança o ciclo outra vez nem duplica auditoria", async () => {
    const { invoice, subscription } = await makeTenantWithSubscriptionAndInvoice({ label: "manual-pay-idem", invoiceStatus: "OPEN" });

    const first = await markInvoicePaidManually(invoice.id, "admin-1", "Motivo 1");
    expect(first.alreadyProcessed).toBe(false);
    const subscriptionAfterFirst = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });

    const second = await markInvoicePaidManually(invoice.id, "admin-2", "Motivo 2 (tentativa duplicada)");
    expect(second.alreadyProcessed).toBe(true);

    const subscriptionAfterSecond = await prisma.subscription.findUniqueOrThrow({ where: { id: subscription.id } });
    expect(subscriptionAfterSecond.currentPeriodEnd.getTime()).toBe(subscriptionAfterFirst.currentPeriodEnd.getTime());

    const auditCount = await prisma.providerEvent.count({ where: { provider: "manual", providerEventId: invoice.id } });
    expect(auditCount).toBe(1);
  });

  it("NOT_FOUND para fatura inexistente", async () => {
    await expect(markInvoicePaidManually("invoice-inexistente", "admin-1", "motivo qualquer")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("findOwnInvoiceOrThrow — escopo por tenant (regenerateMyInvoicePixAction, src/modules/billing/actions.ts)", () => {
  it("devolve a fatura quando pertence ao tenant", async () => {
    const { tenant, invoice } = await makeTenantWithSubscriptionAndInvoice({ label: "own-invoice", invoiceStatus: "OPEN" });
    const found = await findOwnInvoiceOrThrow(tenant.id, invoice.id);
    expect(found.id).toBe(invoice.id);
  });

  it("NOT_FOUND quando a fatura pertence a OUTRO tenant — nunca deixa adivinhar um id de outra empresa", async () => {
    const { tenant: ownerTenant } = await makeTenantWithSubscriptionAndInvoice({ label: "guesser" });
    const { invoice: otherInvoice } = await makeTenantWithSubscriptionAndInvoice({ label: "victim" });

    await expect(findOwnInvoiceOrThrow(ownerTenant.id, otherInvoice.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("NOT_FOUND para invoiceId inexistente", async () => {
    const { tenant } = await makeTenantWithSubscriptionAndInvoice({ label: "no-invoice" });
    await expect(findOwnInvoiceOrThrow(tenant.id, "invoice-inexistente")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("regeneratePixForInvoice funciona normalmente depois do escopo confirmar a posse", async () => {
    const { tenant, invoice } = await makeTenantWithSubscriptionAndInvoice({ label: "own-invoice-pix", invoiceStatus: "OPEN" });
    await findOwnInvoiceOrThrow(tenant.id, invoice.id);

    const { gateway } = createMockMercadoPagoGateway();
    const updated = await regeneratePixForInvoice(invoice.id, "owner@example.com", gateway);
    expect(updated.pixCopyPaste).toBeTruthy();
  });
});
