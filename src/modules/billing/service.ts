import crypto from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { forTenant } from "@/lib/db/tenant-client";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sendMail, invoiceGeneratedEmail, subscriptionSuspendedEmail } from "@/lib/email";
import { env } from "@/env";
import { computeTrialEndsAt, effectiveStatus, type SubscriptionStatus } from "@/core/billing";
import { formatCentsBRL, formatDateBR } from "./format";
import { getMercadoPagoGateway, type MercadoPagoGateway } from "./mercadopago";

/**
 * Camada de serviço da cobrança (docs/arquitetura.md §7). Reúne o que toca banco/e-mail/MP —
 * `src/core/billing` fica só com a matemática pura (`effectiveStatus`, datas de ciclo).
 */

const PIX_EXPIRATION_DAYS = 3;

export function billingUrlFor(tenantSlug: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/${tenantSlug}/assinatura`;
}

// ---------------------------------------------------------------------------
// Plano padrão do cadastro público
// ---------------------------------------------------------------------------

/**
 * Plano assumido no cadastro público (§7.3): o de menor `sortOrder` (Essencial). Deliberadamente
 * NÃO filtra por `active: true` — os planos nascem `active: false` até o dono definir preço
 * (decisão de 2026-09-28, ver `.claude/agent-memory/cronos/fase7_cobranca_decisoes.md`), e o
 * trial precisa funcionar ponta a ponta mesmo antes disso. `active` só controla o que aparece
 * numa futura tela de upgrade/downgrade de plano pago, não o trial gratuito.
 */
export async function getDefaultSignupPlan() {
  const plan = await getPrisma().plan.findFirst({ orderBy: { sortOrder: "asc" } });
  if (!plan) {
    throw new DomainError("NO_PLAN_AVAILABLE", "Nenhum plano cadastrado — contate o suporte.");
  }
  return plan;
}

// ---------------------------------------------------------------------------
// Status efetivo / guards
// ---------------------------------------------------------------------------

export async function getSubscriptionSnapshot(tenantId: string) {
  const subscription = await forTenant(tenantId).subscription.findFirst({});
  if (!subscription) {
    throw new DomainError("NOT_FOUND", "Assinatura não encontrada para esta empresa.");
  }
  return subscription;
}

export async function effectiveStatusForTenant(tenantId: string, now: Date = new Date()): Promise<SubscriptionStatus> {
  const subscription = await getSubscriptionSnapshot(tenantId);
  return effectiveStatus(subscription, now);
}

/**
 * Painel só-leitura quando SUSPENDED (§7.4): toda Server Action que MUTA dados de negócio
 * (agenda, catálogo, clientes) deve chamar isto depois de `requireTenantMember` — nunca antes,
 * porque precisa do `tenant.id` já resolvido pelo slug.
 *
 * `CANCELED` também bloqueia escrita (só a tela de Assinatura, para reativar, funciona — e essa
 * tela usa uma Server Action própria de pagamento/reativação, não esta função).
 */
export async function assertTenantCanWrite(tenantId: string, now: Date = new Date()): Promise<void> {
  const status = await effectiveStatusForTenant(tenantId, now);
  if (status === "SUSPENDED" || status === "CANCELED") {
    throw new DomainError(
      "TENANT_SUSPENDED",
      "Assinatura suspensa: o painel está somente leitura. Pague a fatura em aberto para reativar.",
      { status },
    );
  }
}

/**
 * Usada pelo `claim` do bot (Fase 4, docs/arquitetura.md §2 regra 8, §7.4). Exportada aqui —
 * NÃO editamos `src/modules/bot-api/subscription-gate.ts` (posse da Fase 4/outra instância);
 * o Atlas liga esta função no lugar do `TODO` de lá depois.
 */
export async function isTenantBotAllowedFor(tenantId: string, now: Date = new Date()): Promise<boolean> {
  const status = await effectiveStatusForTenant(tenantId, now);
  return status !== "SUSPENDED" && status !== "CANCELED";
}

// ---------------------------------------------------------------------------
// Criação de fatura + Pix
// ---------------------------------------------------------------------------

/**
 * Cria (ou reaproveita, se já existir para o mesmo `periodStart` — idempotência por
 * `@@unique([subscriptionId, periodStart])`) a fatura de um ciclo e tenta gerar o Pix.
 *
 * Gerar o Pix NUNCA impede a fatura de existir: se o Mercado Pago não está configurado ainda
 * (sem credenciais — PENDÊNCIAS no handoff) ou a chamada falha, a fatura fica `OPEN` sem
 * `pixQrCode`/`pixCopyPaste` — a tela de Assinatura oferece "gerar Pix" (mesmo caminho de
 * `regeneratePixForInvoice`) e o `billing/tick` tenta de novo nas próximas rodadas (Pix
 * "expirado" inclui nunca ter sido gerado, ver `runBillingTick`).
 */
export async function createInvoiceForPeriod(params: {
  subscriptionId: string;
  amountCents: number;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date;
  payerEmail: string;
  description: string;
  gateway?: MercadoPagoGateway;
}) {
  const { invoice } = await createInvoiceForPeriodTracked(params);
  return invoice;
}

/** Igual a `createInvoiceForPeriod`, mas diz se CRIOU (para o tick só disparar o e-mail "fatura gerada" uma vez). */
export async function createInvoiceForPeriodTracked(params: {
  subscriptionId: string;
  amountCents: number;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date;
  payerEmail: string;
  description: string;
  gateway?: MercadoPagoGateway;
}) {
  const prisma = getPrisma();

  const existing = await prisma.invoice.findUnique({
    where: { subscriptionId_periodStart: { subscriptionId: params.subscriptionId, periodStart: params.periodStart } },
  });
  if (existing) {
    return { invoice: existing, created: false };
  }

  const invoice = await prisma.invoice.create({
    data: {
      subscriptionId: params.subscriptionId,
      amountCents: params.amountCents,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      dueAt: params.dueAt,
      status: "OPEN",
    },
  });

  const withPix = await tryAttachPix(invoice.id, params.payerEmail, params.description, params.gateway);
  return { invoice: withPix ?? invoice, created: true };
}

/** Exportada para quem já tem a fatura criada (sem passar pelo check de idempotência de `createInvoiceForPeriodTracked`, que trataria a fatura recém-criada como "já existe" e nunca chamaria isto). */
export async function tryAttachPix(invoiceId: string, payerEmail: string, description: string, gateway?: MercadoPagoGateway) {
  try {
    const mp = gateway ?? (await getMercadoPagoGateway());
    const invoice = await getPrisma().invoice.findUniqueOrThrow({ where: { id: invoiceId } });

    const pix = await mp.createPixPayment({
      externalReference: invoice.id,
      amountCents: invoice.amountCents,
      description,
      payerEmail,
      idempotencyKey: invoice.id, // mesma fatura nunca gera 2 cobranças no MP
      expiresInDays: PIX_EXPIRATION_DAYS,
    });

    return getPrisma().invoice.update({
      where: { id: invoiceId },
      data: {
        mpPaymentId: pix.paymentId,
        pixQrCode: pix.qrCode,
        pixCopyPaste: pix.copyPaste,
        pixExpiresAt: pix.expiresAt,
      },
    });
  } catch (error) {
    logger.warn("billing.pix.create_failed", {
      invoiceId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Regera o Pix de uma fatura OPEN (expirado ou nunca gerado) — mesma linha, nunca cria outra. */
export async function regeneratePixForInvoice(invoiceId: string, payerEmail: string, gateway?: MercadoPagoGateway) {
  const invoice = await getPrisma().invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new DomainError("NOT_FOUND", "Fatura não encontrada.");
  if (invoice.status !== "OPEN") {
    throw new DomainError("INVALID_STATE", "Só é possível gerar Pix para uma fatura em aberto.");
  }
  const updated = await tryAttachPix(invoiceId, payerEmail, "Assinatura InnoChat", gateway);
  if (!updated) {
    throw new DomainError("MERCADOPAGO_UNAVAILABLE", "Não foi possível gerar o Pix agora. Tente novamente em alguns minutos.");
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Pagamento confirmado (webhook / tick reconsultando o MP)
// ---------------------------------------------------------------------------

/**
 * Aplica um pagamento confirmado a uma fatura (docs/arquitetura.md §7.1, §6.10): marca `PAID`,
 * avança `currentPeriodEnd` (mantendo o dia-âncora, ou a partir de `paidAt` se estava
 * `SUSPENDED`) e volta a assinatura para `ACTIVE`. Idempotente: se a fatura já está `PAID`,
 * não faz nada (retorna sem erro) — é o que garante que o mesmo evento do webhook, reentregue
 * pelo Mercado Pago, nunca dá baixa duas vezes nem soma dois meses.
 */
export async function applyInvoicePayment(invoiceId: string, paidAt: Date): Promise<{ alreadyProcessed: boolean }> {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      throw new DomainError("NOT_FOUND", "Fatura não encontrada.");
    }
    if (invoice.status === "PAID") {
      return { alreadyProcessed: true };
    }

    const subscription = await tx.subscription.findUnique({ where: { id: invoice.subscriptionId } });
    if (!subscription) {
      throw new DomainError("NOT_FOUND", "Assinatura não encontrada para esta fatura.");
    }

    const wasSuspended = effectiveStatus(subscription, paidAt) === "SUSPENDED" || subscription.status === "SUSPENDED";
    const anchor = wasSuspended ? paidAt : subscription.currentPeriodEnd;
    const nextPeriodEnd = new Date(anchor);
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

    await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt } });
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: "ACTIVE", currentPeriodEnd: nextPeriodEnd, trialEndsAt: null },
    });

    return { alreadyProcessed: false };
  });
}

// ---------------------------------------------------------------------------
// E-mails de cobrança (usados pelo signup e pelo tick)
// ---------------------------------------------------------------------------

export async function sendInvoiceGeneratedEmail(params: {
  toEmail: string;
  tenantName: string;
  tenantSlug: string;
  amountCents: number;
  dueAt: Date;
  pixCopyPaste: string | null;
  timezone: string;
}) {
  const { subject, html, text } = invoiceGeneratedEmail({
    tenantName: params.tenantName,
    amountReais: formatCentsBRL(params.amountCents),
    dueDateBr: formatDateBR(params.dueAt, params.timezone),
    pixCopyPaste: params.pixCopyPaste ?? "(gere o Pix na tela de Assinatura)",
    billingUrl: billingUrlFor(params.tenantSlug),
  });
  await sendMail({ to: params.toEmail, subject, html, text }).catch((error) => {
    logger.error("billing.email.invoice_generated.failed", { errorMessage: error instanceof Error ? error.message : String(error) });
  });
}

export async function sendSubscriptionSuspendedEmail(params: { toEmail: string; tenantName: string; tenantSlug: string }) {
  const { subject, html, text } = subscriptionSuspendedEmail({
    tenantName: params.tenantName,
    billingUrl: billingUrlFor(params.tenantSlug),
  });
  await sendMail({ to: params.toEmail, subject, html, text }).catch((error) => {
    logger.error("billing.email.suspended.failed", { errorMessage: error instanceof Error ? error.message : String(error) });
  });
}

/** E-mail de quem recebe cobrança: o OWNER mais antigo da empresa (não há campo de e-mail de cobrança dedicado na v1). */
export async function findBillingRecipientEmail(tenantId: string): Promise<string | null> {
  const membership = await forTenant(tenantId).membership.findFirst({
    where: { role: "OWNER" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!membership) return null;
  const user = await getPrisma().user.findUnique({ where: { id: membership.userId }, select: { email: true } });
  return user?.email ?? null;
}

export function newTrialEndsAt(signupAt: Date): Date {
  return computeTrialEndsAt(signupAt);
}

export function generateInvoiceDescription(tenantName: string): string {
  return `Assinatura InnoChat — ${tenantName}`;
}

/** Chave curta para operações que precisam de aleatoriedade (ex.: idempotência local). */
export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}
