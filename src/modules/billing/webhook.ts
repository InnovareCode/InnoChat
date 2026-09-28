import { getPrisma } from "@/lib/db/prisma";
import { isUniqueViolation } from "@/lib/db/prisma-errors";
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

  // Corrida (revisão de segurança 2026-09-28, achado MÉDIA): o MP pode reentregar a mesma
  // notificação quase simultaneamente (retry de rede, ou 2 notificações de status diferentes
  // para o mesmo pagamento). Duas chamadas concorrentes podem ambas ler "não existe" (READ
  // COMMITTED, o isolamento padrão do Postgres) antes que a primeira comite — a segunda
  // `create` então falha por violação da constraint única `provider_providerEventId`. Mesmo
  // padrão `isUniqueViolation` de `claim.ts`/`connection.ts`: trata como "já processado" (a
  // constraint é o backstop final contra a corrida), nunca deixa subir como erro/500.
  //
  // Sem `$transaction` (diferente da versão anterior): uma vez que uma query falha dentro de
  // uma transação interativa do Prisma, a transação Postgres subjacente entra em estado
  // "aborted" e QUALQUER query seguinte na mesma transação falha com "current transaction is
  // aborted" — não dá para simplesmente reler dentro do mesmo `tx` depois de capturar o P2002
  // (mesma lição já aplicada em `claim.ts`: a releitura de recuperação sempre usa uma
  // transação/conexão NOVA, nunca continua na que acabou de falhar). Aqui nem precisávamos da
  // transação para isto: a constraint única já é a fonte de atomicidade real — o
  // `findUnique`+`create` não-transacional é exatamente o padrão "tenta, trata P2002" do resto
  // do código.
  let result: "new" | "already_processed";
  try {
    const existingEvent = await prisma.providerEvent.findUnique({
      where: { provider_providerEventId: { provider: "mercadopago", providerEventId } },
    });
    if (existingEvent?.processedAt) {
      result = "already_processed";
    } else if (existingEvent) {
      // Existe mas ainda não foi marcado como processado (a outra chamada concorrente está no
      // meio do próprio processamento) — segue como "new". O pior caso é aplicar o pagamento em
      // paralelo com a outra chamada, mas `applyInvoicePayment` já é idempotente por si (dupla
      // trava, ver cabeçalho deste arquivo), então não há efeito duplicado real.
      result = "new";
    } else {
      await prisma.providerEvent.create({
        data: { provider: "mercadopago", providerEventId, payload: { status: payment.status, externalReference: payment.externalReference } },
      });
      result = "new";
    }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const concurrent = await prisma.providerEvent.findUniqueOrThrow({
      where: { provider_providerEventId: { provider: "mercadopago", providerEventId } },
    });
    result = concurrent.processedAt ? "already_processed" : "new";
  }

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
