import { getPrisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { applyInvoicePayment } from "./service";
import { getMercadoPagoGateway, verifyMercadoPagoSignature, type MercadoPagoGateway } from "./mercadopago";

/**
 * `POST /api/webhooks/mercadopago` (docs/arquitetura.md §7.1, §6.10). Segue o mesmo formato de
 * erro `{ error: { code, message } }` da API interna (§6.1), embora este endpoint responda ao
 * Mercado Pago, não ao n8n.
 *
 * Fluxo (nunca confia no corpo do webhook para dar baixa — só para saber QUAL pagamento
 * reconsultar):
 * 1. Valida `x-signature` (assinatura HMAC do MP — `verifyMercadoPagoSignature`). Assinatura
 *    inválida → 401, sem tocar no banco.
 * 2. Extrai `data.id` (id do pagamento) do corpo/query.
 * 3. Idempotência por `ProviderEvent(provider, providerEventId)` — `providerEventId` é o id do
 *    pagamento: se o MP reentregar a MESMA notificação (ou duas notificações do mesmo
 *    pagamento, ex.: "pending" e depois "approved"), só processa uma vez de verdade
 *    (`applyInvoicePayment` também é idempotente por si — dupla trava).
 * 4. RECONSULTA o pagamento na API do MP (`gateway.getPayment`) — nunca confia no `status` que
 *    vier no corpo do webhook (podem falsificar a notificação; a chamada autenticada com o
 *    access token é a fonte da verdade).
 * 5. Se `status === "approved"`, aplica o pagamento à fatura (`external_reference` =
 *    `Invoice.id`).
 */

export class WebhookAuthError extends Error {}
export class WebhookIgnored extends Error {}

export type MercadoPagoWebhookBody = {
  data?: { id?: string | number };
  type?: string;
};

export async function handleMercadoPagoWebhook(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  gateway?: MercadoPagoGateway;
}): Promise<{ status: "processed" | "ignored" | "already_processed" }> {
  const prisma = getPrisma();

  if (!params.dataId) {
    throw new WebhookIgnored("Notificação sem data.id — nada a processar.");
  }

  const settings = await prisma.platformSettings.findUnique({ where: { id: 1 }, select: { mercadoPagoWebhookSecret: true } });
  if (!settings?.mercadoPagoWebhookSecret) {
    // Sem segredo configurado ainda: não dá para validar a assinatura com segurança. Registrar
    // e ignorar é mais seguro que aceitar sem checagem (PENDÊNCIAS no handoff — falta credencial).
    logger.warn("billing.webhook.no_secret_configured");
    throw new WebhookAuthError("Mercado Pago não configurado.");
  }

  const validSignature = verifyMercadoPagoSignature({
    xSignature: params.xSignature,
    xRequestId: params.xRequestId,
    dataId: params.dataId,
    secret: settings.mercadoPagoWebhookSecret,
  });
  if (!validSignature) {
    logger.warn("billing.webhook.invalid_signature");
    throw new WebhookAuthError("Assinatura inválida.");
  }

  const providerEventId = params.dataId;

  const gateway = params.gateway ?? (await getMercadoPagoGateway());
  const payment = await gateway.getPayment(providerEventId);

  const result = await prisma.$transaction(async (tx) => {
    const existingEvent = await tx.providerEvent.findUnique({
      where: { provider_providerEventId: { provider: "mercadopago", providerEventId } },
    });
    if (existingEvent?.processedAt) {
      return "already_processed" as const;
    }

    if (!existingEvent) {
      await tx.providerEvent.create({
        data: { provider: "mercadopago", providerEventId, payload: { status: payment.status, externalReference: payment.externalReference } },
      });
    }

    return "new" as const;
  });

  if (result === "already_processed") {
    return { status: "already_processed" };
  }

  if (payment.status !== "approved" || !payment.externalReference) {
    await prisma.providerEvent.update({
      where: { provider_providerEventId: { provider: "mercadopago", providerEventId } },
      data: { processedAt: new Date() },
    });
    return { status: "ignored" };
  }

  await applyInvoicePayment(payment.externalReference, payment.dateApproved ?? new Date());

  await prisma.providerEvent.update({
    where: { provider_providerEventId: { provider: "mercadopago", providerEventId } },
    data: { processedAt: new Date() },
  });

  return { status: "processed" };
}
