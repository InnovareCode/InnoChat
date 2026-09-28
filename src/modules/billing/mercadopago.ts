import crypto from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Adaptador do Mercado Pago (Pix pontual, docs/arquitetura.md §7.1). Interface isolada de
 * propósito — não temos credenciais reais ainda (PENDÊNCIAS no handoff), então todo o resto do
 * módulo de cobrança (webhook, tick) depende de `MercadoPagoGateway`, nunca do SDK/fetch direto,
 * para os testes injetarem `createMockMercadoPagoGateway()` em vez de bater na API real.
 */

export type PixPaymentResult = {
  paymentId: string;
  qrCode: string;
  copyPaste: string;
  expiresAt: Date;
};

export type MercadoPagoPaymentStatus = "approved" | "pending" | "rejected" | "cancelled" | "in_process" | string;

export type MercadoPagoPayment = {
  id: string;
  status: MercadoPagoPaymentStatus;
  dateApproved: Date | null;
  externalReference: string | null;
};

export type CreatePixPaymentInput = {
  /** `Invoice.id` — vai em `external_reference`, é como o webhook re-associa o pagamento à fatura. */
  externalReference: string;
  amountCents: number;
  description: string;
  payerEmail: string;
  /** Chave de idempotência do MP (header `X-Idempotency-Key`) — evita criar 2 cobranças se a chamada for repetida. */
  idempotencyKey: string;
  expiresInDays: number;
};

export interface MercadoPagoGateway {
  createPixPayment(input: CreatePixPaymentInput): Promise<PixPaymentResult>;
  getPayment(paymentId: string): Promise<MercadoPagoPayment>;
}

const PIX_EXPIRATION_DAYS = 3;

const API_BASE = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

/**
 * `fetch` com timeout e retry — só em erro de rede/timeout e 5xx (nunca em 4xx: erro do nosso
 * lado, repetir não ajuda), mesma política do §6.1 ("no n8n: timeout de 10s; retry 3x só em
 * 5xx e timeout, nunca em 409" — aplicamos a mesma régua aqui, chamando o MP em vez de sermos
 * chamados por ele).
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        lastError = new Error(`Mercado Pago respondeu ${response.status}`);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_RETRIES) break;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao chamar Mercado Pago");
}

export class MercadoPagoApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MercadoPagoApiError";
  }
}

/** Implementação real, contra a API do Mercado Pago (Pagamentos Pix). */
export function createMercadoPagoGateway(accessToken: string): MercadoPagoGateway {
  return {
    async createPixPayment(input) {
      const response = await fetchWithRetry(`${API_BASE}/v1/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Idempotency-Key": input.idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: Math.round(input.amountCents) / 100,
          description: input.description,
          payment_method_id: "pix",
          external_reference: input.externalReference,
          payer: { email: input.payerEmail },
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logger.error("mercadopago.createPixPayment.failed", { status: response.status });
        throw new MercadoPagoApiError(`Mercado Pago recusou a criação do Pix (${response.status}): ${body.slice(0, 300)}`, response.status);
      }

      const json = (await response.json()) as {
        id: number | string;
        point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
      };
      const qr = json.point_of_interaction?.transaction_data;
      if (!qr?.qr_code) {
        throw new MercadoPagoApiError("Resposta do Mercado Pago sem QR code Pix.");
      }

      return {
        paymentId: String(json.id),
        qrCode: qr.qr_code,
        copyPaste: qr.qr_code,
        expiresAt: new Date(Date.now() + PIX_EXPIRATION_DAYS * 24 * 60 * 60 * 1000),
      };
    },

    async getPayment(paymentId) {
      const response = await fetchWithRetry(`${API_BASE}/v1/payments/${paymentId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new MercadoPagoApiError(`Mercado Pago recusou a consulta do pagamento (${response.status}).`, response.status);
      }

      const json = (await response.json()) as {
        id: number | string;
        status: string;
        date_approved: string | null;
        external_reference: string | null;
      };

      return {
        id: String(json.id),
        status: json.status,
        dateApproved: json.date_approved ? new Date(json.date_approved) : null,
        externalReference: json.external_reference,
      };
    },
  };
}

/** Resolve o gateway real a partir do access token salvo em `PlatformSettings` (admin da plataforma). */
export async function getMercadoPagoGateway(): Promise<MercadoPagoGateway> {
  const settings = await getPrisma().platformSettings.findUnique({
    where: { id: 1 },
    select: { mercadoPagoAccessToken: true },
  });
  if (!settings?.mercadoPagoAccessToken) {
    throw new DomainError("MERCADOPAGO_NOT_CONFIGURED", "Mercado Pago não configurado em PlatformSettings.");
  }
  return createMercadoPagoGateway(settings.mercadoPagoAccessToken);
}

/**
 * Tolerância contra replay: um `x-signature` capturado (ex.: log de proxy, MITM parcial) não
 * expira por si só — o `ts` está DENTRO do HMAC, mas nada nesse header o compara contra o
 * relógio atual. Sem isto, o mesmo header replayado passaria a validação para sempre. 10 min é
 * generoso o bastante para reentregas legítimas do MP com atraso de rede, e curto o bastante
 * para não ser útil a um replay (revisão de segurança 2026-09-28, achado MÉDIA/INFO).
 */
const SIGNATURE_TOLERANCE_MS = 10 * 60 * 1000;

/**
 * Validação da assinatura do webhook do Mercado Pago (`x-signature`), conferida em 2026-09-28
 * pelo Atlas contra o SDK oficial em Go (`github.com/mercadopago/sdk-go/pkg/webhook`,
 * `ValidateSignature`) — substitui a implementação anterior (feita de memória/doc em texto),
 * que tinha 2 desvios reais:
 *
 * 1. **`data.id` vem do QUERY PARAM**, não do corpo — quem resolve isso é `route.ts` (o corpo
 *    pode nem ter `data.id`, ou pode ter um valor diferente do que o MP realmente assinou; a
 *    assinatura é sobre o que veio na URL da notificação).
 * 2. **Cada par ausente é OMITIDO do manifest**, nunca causa rejeição isolada — antes, `!dataId
 *    || !xRequestId` já devolvia `false` sem nem montar o manifest; o formato correto é: se
 *    `data.id` (ou `request-id`) não vier, o manifest simplesmente não tem aquele segmento, e a
 *    validação segue baseada no que sobrou.
 *
 * O header `x-signature` vem no formato `ts=<timestamp>,v1=<hash>`. A assinatura é
 * `HMAC-SHA256` (hex) do manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (pares
 * ausentes omitidos, nesta ordem), com `data.id` sempre em minúsculas, usando
 * `PlatformSettings.mercadoPagoWebhookSecret` como chave.
 */
export function verifyMercadoPagoSignature(params: {
  xSignature: string | null;
  xRequestId: string | null;
  /** Já deve vir do query param `data.id` (nunca do corpo) — ver `route.ts`. */
  dataId: string | null;
  secret: string;
  /** Só para teste — no runtime real é sempre `new Date()` (injetado via `now` no `webhook.ts`). */
  now?: Date;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature || !secret) return false;

  const parts = new Map<string, string>();
  for (const chunk of xSignature.split(",")) {
    const [key, value] = chunk.split("=").map((s) => s.trim());
    if (key && value) parts.set(key, value);
  }
  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return false;

  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) return false;
  const now = params.now ?? new Date();
  if (Math.abs(now.getTime() - tsSeconds * 1000) > SIGNATURE_TOLERANCE_MS) {
    return false;
  }

  let manifest = "";
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  manifest += `ts:${ts};`;

  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(v1);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}
