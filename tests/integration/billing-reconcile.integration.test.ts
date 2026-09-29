/**
 * Conciliação ativa de Pix + diagnóstico do webhook do Mercado Pago, contra Postgres real e
 * gateway mock: approved baixa / pending não; idempotência com webhook e conciliação concorrentes;
 * credencial pelo ambiente da fatura; rate limit; diagnóstico gravado com cada motivo; tick em lote.
 */
import crypto, { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/crypto";

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return { ...actual, sendMail: vi.fn(async () => ({ sent: true })) };
});

const { reconcileInvoicePayment } = await import("@/modules/billing/reconcile");
const { handleMercadoPagoWebhook, WebhookAuthError } = await import("@/modules/billing/webhook");
const { resetWebhookDiagnosticsThrottle } = await import("@/modules/billing/webhook-diagnostics");
const { createMockMercadoPagoGateway } = await import("@/modules/billing/mercadopago.mock");
const { runBillingTick } = await import("@/modules/billing/tick");
const { tryAttachPix } = await import("@/modules/billing/service");
const { getPlatformHealth } = await import("@/modules/platform/health-service");

const prisma = getPrisma();
const PROD_SECRET = "it-rec-prod-secret";
const TEST_SECRET = "it-rec-test-secret";
const cleanupTenantIds: string[] = [];
const cleanupPaymentIds: string[] = [];

async function setActiveEnvironment(env: "PRODUCTION" | "SANDBOX", secrets: { prod?: string | null; test?: string | null } = {}) {
  const data = {
    mpEnvironment: env,
    mercadoPagoWebhookSecret: null,
    mpProdWebhookSecretEnc: secrets.prod === null ? null : encryptSecret(secrets.prod ?? PROD_SECRET),
    mpTestWebhookSecretEnc: secrets.test === null ? null : encryptSecret(secrets.test ?? TEST_SECRET),
  };
  await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
}

beforeAll(async () => {
  await setActiveEnvironment("PRODUCTION");
});

afterAll(async () => {
  await prisma.providerEvent.deleteMany({ where: { providerEventId: { in: cleanupPaymentIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: cleanupTenantIds } } });
  await prisma.$disconnect();
});

type Env = "PRODUCTION" | "SANDBOX";

async function makeOpenInvoiceWithPix(label: string, opts: { mpEnvironment?: Env | null; mock?: ReturnType<typeof createMockMercadoPagoGateway> } = {}) {
  const mock = opts.mock ?? createMockMercadoPagoGateway();
  const slug = `it-rec-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`;
  const tenant = await prisma.tenant.create({ data: { slug, name: `Rec ${label}`, timezone: "UTC" } });
  cleanupTenantIds.push(tenant.id);
  const plan = await prisma.plan.create({
    data: { code: `${slug}-plan`, name: "Plano IT", priceCents: 5990, maxWhatsappNumbers: 1, maxProfessionals: 1, active: false, sortOrder: 999 },
  });
  const periodEnd = new Date();
  const subscription = await prisma.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "ACTIVE", currentPeriodEnd: periodEnd } });
  const invoice = await prisma.invoice.create({
    data: { subscriptionId: subscription.id, amountCents: 5990, periodStart: new Date(0), periodEnd, dueAt: periodEnd, status: "OPEN" },
  });
  const pix = await mock.gateway.createPixPayment({
    externalReference: invoice.id,
    amountCents: 5990,
    description: "x",
    payerEmail: "a@b.c",
    payerName: "Fulano",
    payerDocument: "52998224725",
    idempotencyKey: invoice.id,
    expiresInDays: 3,
  });
  cleanupPaymentIds.push(pix.paymentId);
  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { mpPaymentId: pix.paymentId, mpEnvironment: opts.mpEnvironment === undefined ? "PRODUCTION" : opts.mpEnvironment },
  });
  return { mock, tenant, subscription, invoice: updated, paymentId: pix.paymentId };
}

function sign(secret: string, dataId: string, ts: string = String(Math.floor(Date.now() / 1000)), requestId = "req-1") {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  return { xSignature: `ts=${ts},v1=${crypto.createHmac("sha256", secret).update(manifest).digest("hex")}`, xRequestId: requestId };
}

describe("reconcileInvoicePayment", () => {
  it("approved baixa a fatura, avança o ciclo e audita; pending NÃO baixa", async () => {
    const pending = await makeOpenInvoiceWithPix("pending");
    const r1 = await reconcileInvoicePayment(pending.invoice.id, { source: "tenant_poll", gateway: pending.mock.gateway, minIntervalMs: 0 });
    expect(r1).toEqual({ status: "pending", mpStatus: "pending" });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: pending.invoice.id } })).status).toBe("OPEN");

    const paid = await makeOpenInvoiceWithPix("approved");
    paid.mock.approve(paid.paymentId);
    const r2 = await reconcileInvoicePayment(paid.invoice.id, { source: "admin_button", gateway: paid.mock.gateway, minIntervalMs: 0 });
    expect(r2.status).toBe("paid");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: paid.invoice.id } })).status).toBe("PAID");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: paid.subscription.id } });
    expect(sub.currentPeriodEnd.getTime()).toBeGreaterThan(paid.subscription.currentPeriodEnd.getTime());
    const audit = await prisma.providerEvent.findUnique({
      where: { provider_providerEventId: { provider: "mercadopago-reconcile", providerEventId: paid.paymentId } },
    });
    expect((audit?.payload as { source: string }).source).toBe("admin_button");

    // Repetir não soma outro mês.
    const r3 = await reconcileInvoicePayment(paid.invoice.id, { source: "tick", gateway: paid.mock.gateway, minIntervalMs: 0 });
    expect(r3.status).toBe("already_paid");
    const sub2 = await prisma.subscription.findUniqueOrThrow({ where: { id: paid.subscription.id } });
    expect(sub2.currentPeriodEnd.getTime()).toBe(sub.currentPeriodEnd.getTime());
  });

  it.each(["rejected", "cancelled", "expired"])("status %s não baixa", async (mpStatus) => {
    const t = await makeOpenInvoiceWithPix(`fail-${mpStatus}`);
    t.mock.setStatus(t.paymentId, mpStatus);
    const result = await reconcileInvoicePayment(t.invoice.id, { source: "tick", gateway: t.mock.gateway, minIntervalMs: 0 });
    expect(result).toEqual({ status: "payment_failed", mpStatus });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: t.invoice.id } })).status).toBe("OPEN");
  });

  it("pagamento de outra fatura (external_reference diferente) nunca baixa", async () => {
    const shared = createMockMercadoPagoGateway();
    const a = await makeOpenInvoiceWithPix("mismatch-a", { mock: shared });
    const b = await makeOpenInvoiceWithPix("mismatch-b", { mock: shared });
    shared.approve(b.paymentId);
    // Aponta a fatura A para o pagamento (aprovado) da fatura B.
    await prisma.invoice.update({ where: { id: a.invoice.id }, data: { mpPaymentId: b.paymentId } });
    const result = await reconcileInvoicePayment(a.invoice.id, { source: "tick", gateway: shared.gateway, minIntervalMs: 0 });
    expect(result).toEqual({ status: "error", code: "PAYMENT_MISMATCH" });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: a.invoice.id } })).status).toBe("OPEN");
  });

  it("idempotente e race-safe com webhook + conciliações concorrentes (1 baixa, 1 mês)", async () => {
    const t = await makeOpenInvoiceWithPix("race");
    t.mock.approve(t.paymentId);
    const { xSignature, xRequestId } = sign(PROD_SECRET, t.paymentId);

    await Promise.all([
      handleMercadoPagoWebhook({ xSignature, xRequestId, dataId: t.paymentId, type: "payment", gateway: t.mock.gateway }),
      reconcileInvoicePayment(t.invoice.id, { source: "tick", gateway: t.mock.gateway, minIntervalMs: 0 }),
      reconcileInvoicePayment(t.invoice.id, { source: "tenant_poll", gateway: t.mock.gateway, minIntervalMs: 0 }),
      reconcileInvoicePayment(t.invoice.id, { source: "admin_button", gateway: t.mock.gateway, minIntervalMs: 0 }),
    ]);

    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: t.invoice.id } })).status).toBe("PAID");
    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: t.subscription.id } });
    const expected = new Date(t.subscription.currentPeriodEnd);
    expected.setMonth(expected.getMonth() + 1);
    expect(sub.currentPeriodEnd.getTime()).toBe(expected.getTime());
  });

  it("usa as credenciais do ambiente DA FATURA, não o ativo; legado (nulo) tenta o ativo primeiro", async () => {
    await setActiveEnvironment("PRODUCTION");
    const sandboxInvoice = await makeOpenInvoiceWithPix("env-sandbox", { mpEnvironment: "SANDBOX" });
    sandboxInvoice.mock.approve(sandboxInvoice.paymentId);
    const resolveGateway = vi.fn(async (env: Env) => {
      void env;
      return sandboxInvoice.mock.gateway;
    });
    const r = await reconcileInvoicePayment(sandboxInvoice.invoice.id, { source: "tick", resolveGateway, minIntervalMs: 0 });
    expect(resolveGateway).toHaveBeenCalledTimes(1);
    expect(resolveGateway).toHaveBeenCalledWith("SANDBOX");
    expect(r).toEqual({ status: "paid", environment: "SANDBOX" });

    // Legado (mpEnvironment nulo) com o ambiente ATIVO = SANDBOX (caso real do dono).
    await setActiveEnvironment("SANDBOX");
    const legacy = await makeOpenInvoiceWithPix("env-legacy", { mpEnvironment: null });
    legacy.mock.approve(legacy.paymentId);
    const resolveLegacy = vi.fn(async (env: Env) => {
      void env;
      return legacy.mock.gateway;
    });
    const r2 = await reconcileInvoicePayment(legacy.invoice.id, { source: "tick", resolveGateway: resolveLegacy, minIntervalMs: 0 });
    expect(resolveLegacy.mock.calls[0]).toEqual(["SANDBOX"]);
    expect(r2).toEqual({ status: "paid", environment: "SANDBOX" });
    // O ambiente descoberto é gravado na fatura legada.
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: legacy.invoice.id } })).mpEnvironment).toBe("SANDBOX");
    await setActiveEnvironment("PRODUCTION");
  });

  it("rate limit por fatura: 2ª consulta dentro de 5s não chama o MP", async () => {
    const t = await makeOpenInvoiceWithPix("ratelimit");
    const spy = vi.spyOn(t.mock.gateway, "getPayment");
    const first = await reconcileInvoicePayment(t.invoice.id, { source: "tenant_poll", gateway: t.mock.gateway });
    const second = await reconcileInvoicePayment(t.invoice.id, { source: "tenant_poll", gateway: t.mock.gateway });
    expect(first.status).toBe("pending");
    expect(second).toEqual({ status: "throttled" });
    expect(spy).toHaveBeenCalledTimes(1);
    // 6s depois volta a consultar.
    const later = await reconcileInvoicePayment(t.invoice.id, { source: "tenant_poll", gateway: t.mock.gateway, now: new Date(Date.now() + 6_000) });
    expect(later.status).toBe("pending");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("Pix gerado grava o ambiente (mpEnvironment) na fatura", async () => {
    await setActiveEnvironment("SANDBOX");
    const t = await makeOpenInvoiceWithPix("attach", { mpEnvironment: null });
    await prisma.invoice.update({ where: { id: t.invoice.id }, data: { mpPaymentId: null } });
    await prisma.tenant.update({ where: { id: t.tenant.id }, data: { document: "52998224725" } });
    const owner = await prisma.user.create({ data: { email: `${t.tenant.slug}@example.com`, passwordHash: "x", emailVerifiedAt: new Date() } });
    await prisma.membership.create({ data: { userId: owner.id, tenantId: t.tenant.id, role: "OWNER" } });
    const updated = await tryAttachPix(t.invoice.id, "a@b.c", "x", t.mock.gateway);
    expect(updated?.mpEnvironment).toBe("SANDBOX");
    await prisma.user.delete({ where: { id: owner.id } }).catch(() => undefined);
    await setActiveEnvironment("PRODUCTION");
  });
});

describe("billing/tick concilia em lote", () => {
  it("baixa as faturas OPEN aprovadas no MP e deixa as pendentes", async () => {
    const shared = createMockMercadoPagoGateway();
    const a = await makeOpenInvoiceWithPix("tick-a", { mock: shared });
    const b = await makeOpenInvoiceWithPix("tick-b", { mock: shared });
    const c = await makeOpenInvoiceWithPix("tick-c", { mock: shared });
    shared.approve(a.paymentId);
    shared.approve(b.paymentId);
    // c segue pending.

    const summary = await runBillingTick(new Date(), shared.gateway);
    expect(summary.invoicesReconciledPaid).toBeGreaterThanOrEqual(2);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: a.invoice.id } })).status).toBe("PAID");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: b.invoice.id } })).status).toBe("PAID");
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: c.invoice.id } })).status).toBe("OPEN");
  });
});

describe("diagnóstico do webhook", () => {
  async function expectRejection(reason: string, params: Parameters<typeof handleMercadoPagoWebhook>[0]) {
    resetWebhookDiagnosticsThrottle();
    await expect(handleMercadoPagoWebhook(params)).rejects.toBeInstanceOf(WebhookAuthError);
    const row = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.lastMpWebhookRejectedAt).not.toBeNull();
    expect((row.lastMpWebhookRejection as { reason: string }).reason).toBe(reason);
    // Nada de segredo/assinatura/corpo no que foi gravado.
    const stored = JSON.stringify([row.lastMpWebhookResult, row.lastMpWebhookRejection]);
    expect(stored).not.toContain(PROD_SECRET);
    expect(stored).not.toContain(TEST_SECRET);
    expect(stored).not.toContain("v1=");
  }

  it("grava cada motivo de rejeição", async () => {
    await setActiveEnvironment("PRODUCTION");
    const id = "999001";
    await expectRejection("missing_signature", { xSignature: null, xRequestId: "r", dataId: id, type: "payment" });
    await expectRejection("bad_signature", { ...sign("outro-segredo-qualquer", id), dataId: id, type: "payment" });
    const oldTs = String(Math.floor(Date.now() / 1000) - 3600);
    await expectRejection("stale_timestamp", { ...sign(PROD_SECRET, id, oldTs), dataId: id, type: "payment" });
    // Assinatura feita com o segredo do OUTRO ambiente (painel do MP em modo teste, ativo = produção).
    await expectRejection("wrong_environment_secret", { ...sign(TEST_SECRET, id), dataId: id, type: "payment" });
    // Sem segredo salvo para o ambiente ativo.
    await setActiveEnvironment("PRODUCTION", { prod: null });
    await expectRejection("no_secret_for_env", { ...sign(PROD_SECRET, id), dataId: id, type: "payment" });
    await setActiveEnvironment("PRODUCTION");
  });

  it("grava último recebido (ignorado e aceito) e expõe em Admin → Saúde", async () => {
    await setActiveEnvironment("PRODUCTION");
    const id = "999002";
    const ignored = await handleMercadoPagoWebhook({ ...sign(PROD_SECRET, id), dataId: id, type: "merchant_order" });
    expect(ignored.status).toBe("ignored");
    let row = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.lastMpWebhookResult).toMatchObject({ outcome: "ignored", reason: "ignored_type", environment: "PRODUCTION" });

    const t = await makeOpenInvoiceWithPix("diag-ok");
    t.mock.approve(t.paymentId);
    const ok = await handleMercadoPagoWebhook({ ...sign(PROD_SECRET, t.paymentId), dataId: t.paymentId, type: "payment", gateway: t.mock.gateway });
    expect(ok.status).toBe("processed");
    row = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(row.lastMpWebhookResult).toMatchObject({ outcome: "processed" });

    const health = await getPlatformHealth();
    expect(health.mercadoPagoWebhook.lastReceivedAt).not.toBeNull();
    expect(health.mercadoPagoWebhook.lastOutcome).toBe("processed");
    expect(health.mercadoPagoWebhook.lastRejectedAt).not.toBeNull();
  });
});
