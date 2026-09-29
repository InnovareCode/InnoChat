import { getPrisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import type { MercadoPagoEnv } from "@/modules/platform/mercadopago-config";

/**
 * Diagnóstico do webhook do Mercado Pago (Admin → Saúde). Grava em `PlatformSettings` o ÚLTIMO
 * webhook recebido e a ÚLTIMA rejeição com o motivo. NUNCA grava corpo, assinatura ou segredo —
 * só `{ outcome|reason, environment, type }`. Falha de gravação nunca derruba o webhook.
 */

export type WebhookRejectionReason =
  | "missing_signature"
  | "malformed_signature"
  | "bad_signature"
  | "stale_timestamp"
  | "no_secret_for_env"
  | "wrong_environment_secret"
  | "ignored_type"
  | "missing_data_id";

export type WebhookOutcome = "processed" | "already_processed" | "ignored" | "rejected";

/** `type` vem de quem chama a rota pública: só valores conhecidos vão para log/banco; o resto vira "other". */
const KNOWN_WEBHOOK_TYPES = new Set(["payment", "merchant_order", "plan", "subscription", "subscription_preapproval", "subscription_authorized_payment", "point_integration_wh", "topic_merchant_order_wh", "topic_claims_integration_wh", "delivery", "shipments", "stop_delivery_op_wh"]);

export function sanitizeWebhookType(type: string | null | undefined): string | null {
  if (!type) return null;
  return KNOWN_WEBHOOK_TYPES.has(type) ? type : "other";
}

export type WebhookDiagnosticsInfo = { environment: MercadoPagoEnv; type?: string | null };

/** Rejeições vêm de endpoint público: no máximo 1 escrita a cada 2s (evita amplificação de escrita no banco). */
const REJECTION_WRITE_INTERVAL_MS = 2_000;
let lastRejectionWriteAt = 0;

async function upsertSettings(data: Record<string, unknown>) {
  await getPrisma().platformSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data } as never, update: data as never });
}

export async function recordWebhookReceived(outcome: WebhookOutcome, info: WebhookDiagnosticsInfo, reason?: WebhookRejectionReason, now: Date = new Date()): Promise<void> {
  try {
    await upsertSettings({
      lastMpWebhookAt: now,
      lastMpWebhookResult: { outcome, ...(reason ? { reason } : {}), environment: info.environment, type: info.type ?? null },
    });
  } catch (error) {
    logger.warn("billing.webhook.diagnostics_failed", { errorMessage: error instanceof Error ? error.message : String(error) });
  }
}

export async function recordWebhookRejected(reason: WebhookRejectionReason, info: WebhookDiagnosticsInfo, now: Date = new Date()): Promise<void> {
  // Log estruturado SEMPRE (sem segredo); a escrita no banco é que tem throttle.
  logger.warn("billing.webhook.rejected", { reason, environment: info.environment, type: info.type ?? null });
  if (now.getTime() - lastRejectionWriteAt < REJECTION_WRITE_INTERVAL_MS) return;
  lastRejectionWriteAt = now.getTime();
  try {
    await upsertSettings({
      lastMpWebhookAt: now,
      lastMpWebhookResult: { outcome: "rejected", reason, environment: info.environment, type: info.type ?? null },
      lastMpWebhookRejectedAt: now,
      lastMpWebhookRejection: { reason, environment: info.environment, type: info.type ?? null },
    });
  } catch (error) {
    logger.warn("billing.webhook.diagnostics_failed", { errorMessage: error instanceof Error ? error.message : String(error) });
  }
}

/** Só para teste: zera o throttle de escrita das rejeições. */
export function resetWebhookDiagnosticsThrottle(): void {
  lastRejectionWriteAt = 0;
}
