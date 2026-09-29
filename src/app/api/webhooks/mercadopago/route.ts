import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { handleMercadoPagoWebhook, WebhookAuthError, WebhookIgnored, type MercadoPagoWebhookBody } from "@/modules/billing/webhook";

/**
 * Webhook do Mercado Pago (docs/arquitetura.md §7.1, §6.10). O MP espera 200 rápido — qualquer
 * corpo de resposta é ignorado por ele, então devolvemos um JSON mínimo só para quem for
 * depurar. NUNCA 5xx para payload que só está mal formado (mesma régua do `claim`, §6.2):
 * corpo irreconhecível vira `ignored`, não erro.
 */
export async function POST(req: Request) {
  let body: MercadoPagoWebhookBody = {};
  try {
    body = (await req.json()) as MercadoPagoWebhookBody;
  } catch {
    // Corpo vazio/inválido — o MP também manda notificação só por query string em alguns casos.
  }

  // `data.id` vem do QUERY PARAM da notificação — é o que o Mercado Pago de fato assina (ver
  // `mercadopago.ts#verifyMercadoPagoSignature`, conferido contra o SDK oficial em Go). O corpo
  // é só um fallback para notificações antigas/mal formadas que não tragam a query string.
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? (body.data?.id != null ? String(body.data.id) : null);
  // `type` (formato novo) ou `topic` (formato antigo, `?topic=merchant_order&id=...`) — o corpo é
  // o fallback, igual ao `data.id` acima (conferido contra o Parque das Feiras,
  // `AdaptadorMercadoPago#interpretarNotificacao`, que aceita os dois igualmente).
  const type = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? body.topic ?? null;

  try {
    const result = await handleMercadoPagoWebhook({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
      type,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof WebhookAuthError) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: error.message } }, { status: 401 });
    }
    if (error instanceof WebhookIgnored) {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }
    logger.error("billing.webhook.unexpected_error", { errorMessage: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: { code: "INTERNAL", message: "Erro ao processar notificação." } }, { status: 500 });
  }
}
