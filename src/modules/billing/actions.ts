"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { DomainError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { changePlan, findBillingRecipientEmail, findOwnInvoiceOrThrow, listActivePlans, regeneratePixForInvoice, type ChangePlanResult } from "./service";

/**
 * Server Actions de cobrança do lado da empresa (docs/arquitetura.md §7.2, tela de Assinatura).
 * Sem `assertTenantCanWrite`: a tela de Assinatura funciona mesmo com a assinatura `SUSPENDED`
 * (§7.4 — é o único jeito de a empresa conseguir pagar/trocar de plano para saír de lá).
 */

export type PlanListItem = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  maxWhatsappNumbers: number;
  maxProfessionals: number | null;
  sortOrder: number;
};

export async function listActivePlansAction(tenantSlug: string): Promise<Result<PlanListItem[]>> {
  return runAction(async () => {
    await requireTenantMember(tenantSlug);
    const plans = await listActivePlans();
    return plans.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      priceCents: p.priceCents,
      maxWhatsappNumbers: p.maxWhatsappNumbers,
      maxProfessionals: p.maxProfessionals,
      sortOrder: p.sortOrder,
    }));
  });
}

const changePlanSchema = z.object({ planId: z.string().min(1) });

/** Restrito a `OWNER` — troca de plano é decisão de dinheiro da empresa, não do dia a dia (mesma régua de `updateTenantThemeAction`). */
export async function changePlanAction(tenantSlug: string, input: unknown): Promise<Result<ChangePlanResult>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    const data = changePlanSchema.parse(input);
    return changePlan(tenant.id, data.planId);
  });
}

const REGENERATE_PIX_LIMIT = 5;
const REGENERATE_PIX_WINDOW_MS = 10 * 60 * 1000; // 5 tentativas/10min por empresa — chama o Mercado Pago de verdade

/**
 * "Gerar Pix agora"/"Tentar de novo" (tela de Assinatura) — hoje `regeneratePixForInvoice` só
 * rodava em segundo plano pelo `billing/tick` (de hora em hora); esta action deixa a EMPRESA
 * disparar na hora, depois de ver `MERCADOPAGO_MISSING_DOCUMENT` (cadastrar documento em
 * Configurações e tentar de novo) ou `MERCADOPAGO_UNAVAILABLE` (tentar de novo). Restrito a
 * `OWNER` (mesma régua de `changePlanAction`) e escopado por `findOwnInvoiceOrThrow` — o
 * `invoiceId` nunca é confiado sem confirmar que pertence à assinatura DESTE tenant (nunca de
 * outra empresa, mesmo que alguém adivinhe/tente um id de fatura de outra conta). Rate limit
 * leve por tenant: é uma chamada de rede de verdade ao Mercado Pago, não um clique de UI barato.
 */
export async function regenerateMyInvoicePixAction(tenantSlug: string, invoiceId: string): Promise<Result<{ invoiceId: string; pixCopyPaste: string | null }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);

    const rateLimit = checkRateLimit(`regenerate-pix:${tenant.id}`, REGENERATE_PIX_LIMIT, REGENERATE_PIX_WINDOW_MS);
    if (!rateLimit.allowed) {
      throw new DomainError("RATE_LIMITED", "Muitas tentativas. Aguarde alguns minutos antes de tentar de novo.", {
        retryAfterMs: rateLimit.retryAfterMs,
      });
    }

    await findOwnInvoiceOrThrow(tenant.id, invoiceId);

    const payerEmail = (await findBillingRecipientEmail(tenant.id)) ?? undefined;
    if (!payerEmail) {
      // Não deveria acontecer (toda empresa nasce com um OWNER, e `Membership` nunca perde o
      // último OWNER) — mas sem e-mail de cobrança não há para quem o Mercado Pago devolver
      // notificação, então falha cedo com uma mensagem clara em vez de mandar `undefined`.
      throw new DomainError("NOT_FOUND", "Nenhum e-mail de cobrança encontrado para esta empresa. Contate o suporte.");
    }

    const invoice = await regeneratePixForInvoice(invoiceId, payerEmail);
    return { invoiceId: invoice.id, pixCopyPaste: invoice.pixCopyPaste };
  });
}
