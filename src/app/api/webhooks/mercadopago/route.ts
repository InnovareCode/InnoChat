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

  const url = new URL(req.url);
  const dataId = body.data?.id != null ? String(body.data.id) : url.searchParams.get("data.id") ?? url.searchParams.get("id");

  try {
    const result = await handleMercadoPagoWebhook({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId,
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
