import { addDays, addMonths } from "date-fns";
import type { SubscriptionSnapshot, SubscriptionStatus } from "./types";

/**
 * Carência (decisão do dono, 2026-09-28): 1 dia, tanto no fim do trial quanto no fim de um
 * ciclo pago (§7.4 da tabela de status).
 */
export const GRACE_DAYS = 1;

/** Tempo em SUSPENDED antes de virar CANCELED (§7.4). */
export const CANCEL_AFTER_SUSPENDED_DAYS = 60;

/** Trial (decisão do dono, 2026-09-29 — trocou de 1 para 3 dias; carência continua em 1 dia, ver `GRACE_DAYS`): 3 dias a partir do cadastro. */
export const TRIAL_DAYS = 3;

export function computeTrialEndsAt(signupAt: Date): Date {
  return addDays(signupAt, TRIAL_DAYS);
}

/**
 * Status EFETIVO de uma assinatura em `now`, calculado sob demanda (§7.4: "O status efetivo é
 * calculado sob demanda... Se o cron falhar, o acesso continua correto"). Pura: nunca lê nem
 * grava nada — `billing/tick` (src/modules/billing/tick.ts) é quem persiste a mudança.
 *
 * Regras:
 * - `CANCELED` é terminal: uma vez cancelada (pelo dono da empresa ou por 60 dias em
 *   `SUSPENDED`), só volta por uma ação explícita do admin (fora desta função).
 * - Enquanto `status` persistido é `TRIALING`, o vencimento de referência é `trialEndsAt`.
 *   Nos demais casos (`ACTIVE`/`PAST_DUE`/`SUSPENDED`), é `currentPeriodEnd` — que só avança
 *   quando um pagamento é confirmado (`computeNextPeriodEnd`). Isso é o que permite ao
 *   `status` persistido estar "atrasado" (ex.: ainda `PAST_DUE` no banco) sem afetar o
 *   resultado: se o pagamento já moveu `currentPeriodEnd` para o futuro, o efetivo já é
 *   `ACTIVE`, mesmo antes do próximo `tick` persistir isso.
 * - Depois do vencimento: `GRACE_DAYS` de carência (`PAST_DUE`), depois `SUSPENDED`, depois
 *   `CANCELED` após `CANCEL_AFTER_SUSPENDED_DAYS` em `SUSPENDED`.
 */
export function effectiveStatus(subscription: SubscriptionSnapshot, now: Date): SubscriptionStatus {
  if (subscription.status === "CANCELED") {
    return "CANCELED";
  }

  const isTrial = subscription.status === "TRIALING";
  const dueAt = isTrial ? subscription.trialEndsAt ?? subscription.currentPeriodEnd : subscription.currentPeriodEnd;

  if (now < dueAt) {
    return isTrial ? "TRIALING" : "ACTIVE";
  }

  const graceEnd = addDays(dueAt, GRACE_DAYS);
  if (now < graceEnd) {
    return "PAST_DUE";
  }

  const cancelAt = addDays(graceEnd, CANCEL_AFTER_SUSPENDED_DAYS);
  if (now < cancelAt) {
    return "SUSPENDED";
  }

  return "CANCELED";
}

/**
 * `currentPeriodEnd` depois de um pagamento confirmado (§7.1): "+1 mês a partir do vencimento
 * anterior (mantém o dia-âncora)"; mas "se a empresa estava SUSPENDED, o novo período conta a
 * partir de `paidAt`" — perder o dia-âncora é o preço de ter ficado suspenso, e evita que a
 * empresa "ganhe de volta" os dias em que ficou sem pagar.
 */
export function computeNextPeriodEnd(params: {
  currentPeriodEnd: Date;
  wasSuspended: boolean;
  paidAt: Date;
}): Date {
  const anchor = params.wasSuspended ? params.paidAt : params.currentPeriodEnd;
  return addMonths(anchor, 1);
}

/** `true` quando falta `leadDays` dias ou menos para `dueAt` (ou já venceu). */
export function isWithinLeadDays(dueAt: Date, now: Date, leadDays: number): boolean {
  return addDays(now, leadDays) >= dueAt;
}
