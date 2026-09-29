import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `createPixPayment` chama `tryGetPublicBaseUrl()` para montar `notification_url` — sem mockar,
// isso bateria em `getPrisma()` de verdade (fora de escopo de um teste unitário). Fixo em
// `null` por padrão (comportamento "sem URL pública ainda") e sobrescrevo por teste quando
// preciso verificar o campo no corpo.
const tryGetPublicBaseUrl = vi.hoisted(() => vi.fn(async () => null as string | null));
vi.mock("@/lib/public-url", () => ({ tryGetPublicBaseUrl }));

const { createMercadoPagoGateway, MercadoPagoApiError, verifyMercadoPagoSignature, explainMercadoPagoSignature } = await import("./mercadopago");

/**
 * Corpo enviado ao Mercado Pago na criação do Pix, conferido item a item contra o Parque das
 * Feiras (`backend/src/lib/mercadopago.ts#createPixCharge` e
 * `backend/tests/payments.pix.cpf.test.ts`) — ver a tabela "PF vs InnoChat vs decisão" em
 * `docs/contratos.md`.
 */
describe("createMercadoPagoGateway — createPixPayment", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  const baseInput = {
    externalReference: "invoice_1",
    amountCents: 15050,
    description: "Assinatura InnoChat",
    payerEmail: "owner@example.com",
    payerName: "Maria Silva",
    idempotencyKey: "invoice_1",
    expiresInDays: 3,
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    tryGetPublicBaseUrl.mockReset();
    tryGetPublicBaseUrl.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("FALHA CEDO sem chamar o Mercado Pago quando falta payerDocument (mesma defesa do incidente do Parque das Feiras)", async () => {
    const gateway = createMercadoPagoGateway("token");

    const promise = gateway.createPixPayment({ ...baseInput, payerDocument: null });
    await expect(promise).rejects.toBeInstanceOf(MercadoPagoApiError);
    await expect(promise).rejects.toMatchObject({ kind: "missing_payer_document" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia payer.identification com CPF (11 dígitos) e first_name/last_name quebrados do nome", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "MP-1",
        point_of_interaction: { transaction_data: { qr_code: "qr-copia-e-cola" } },
        date_of_expiration: "2026-10-01T10:00:00.000Z",
      }),
    );
    const gateway = createMercadoPagoGateway("token");

    await gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.payer).toMatchObject({
      email: "owner@example.com",
      first_name: "Maria",
      last_name: "Silva",
      identification: { type: "CPF", number: "52998224725" },
    });
  });

  it("envia payer.identification com CNPJ (14 dígitos)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "MP-2", point_of_interaction: { transaction_data: { qr_code: "qr" } } }));
    const gateway = createMercadoPagoGateway("token");

    await gateway.createPixPayment({ ...baseInput, payerDocument: "11222333000181" });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.payer.identification).toEqual({ type: "CNPJ", number: "11222333000181" });
  });

  it("manda date_of_expiration no corpo e usa o valor DEVOLVIDO pelo MP como expiresAt (não o calculado localmente)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "MP-3",
        point_of_interaction: { transaction_data: { qr_code: "qr" } },
        date_of_expiration: "2026-10-05T00:00:00.000Z",
      }),
    );
    const gateway = createMercadoPagoGateway("token");

    const result = await gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(typeof body.date_of_expiration).toBe("string");
    expect(result.expiresAt.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("inclui notification_url quando há URL pública resolvível, omite quando não há", async () => {
    tryGetPublicBaseUrl.mockResolvedValue("https://app.innochat.com.br");
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "MP-4", point_of_interaction: { transaction_data: { qr_code: "qr" } } }));
    const gateway = createMercadoPagoGateway("token");

    await gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.notification_url).toBe("https://app.innochat.com.br/api/webhooks/mercadopago");
  });

  it("nunca lança quando não há URL pública ainda — só omite notification_url", async () => {
    tryGetPublicBaseUrl.mockResolvedValue(null);
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "MP-5", point_of_interaction: { transaction_data: { qr_code: "qr" } } }));
    const gateway = createMercadoPagoGateway("token");

    await gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(init.body as string);
    expect(body.notification_url).toBeUndefined();
  });

  it("classifica 'payer.identification.number attribute can't be null' como missing_payer_document (defesa em profundidade, o MP ainda recusou apesar do CPF)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "payer.identification.number attribute can't be null", cause: [{ code: 4051 }] }, 400),
    );
    const gateway = createMercadoPagoGateway("token");

    await expect(gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" })).rejects.toMatchObject({
      kind: "missing_payer_document",
      status: 400,
    });
  });

  it("classifica conta sem chave Pix (13253) como pix_key_not_enabled — nunca como erro de CPF", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "bad request", cause: [{ code: 13253, description: "Collector user without key enabled for QR render" }] }, 400),
    );
    const gateway = createMercadoPagoGateway("token");

    await expect(gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" })).rejects.toMatchObject({
      kind: "pix_key_not_enabled",
    });
  });

  it("classifica 401 como invalid_credentials", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "invalid access token" }, 401));
    const gateway = createMercadoPagoGateway("token");

    await expect(gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" })).rejects.toMatchObject({
      kind: "invalid_credentials",
    });
  });

  it("classifica 429 como rate_limited e 500 como unavailable", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));
    const gateway = createMercadoPagoGateway("token");
    await expect(gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" })).rejects.toMatchObject({ kind: "rate_limited" });

    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    await expect(gateway.createPixPayment({ ...baseInput, payerDocument: "52998224725" })).rejects.toMatchObject({ kind: "unavailable" });
  });
});

/**
 * `verifyMercadoPagoSignature` conferido em 2026-09-28 contra o SDK oficial em Go
 * (`github.com/mercadopago/sdk-go/pkg/webhook`, `ValidateSignature`) — cada regra abaixo cobre
 * um dos pontos que o Atlas trouxe do SDK, incluindo os 2 desvios corrigidos nesta rodada
 * (lowercase já estava certo; omissão de pares ausentes e tolerância de `ts` são novos).
 */

const SECRET = "webhook-secret";

function sign(manifest: string): string {
  return crypto.createHmac("sha256", SECRET).update(manifest).digest("hex");
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

describe("verifyMercadoPagoSignature", () => {
  it("aceita assinatura válida com id, request-id e ts todos presentes", () => {
    const ts = String(nowSeconds());
    const manifest = `id:pay_123;request-id:req-1;ts:${ts};`;
    const v1 = sign(manifest);
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "pay_123", secret: SECRET }),
    ).toBe(true);
  });

  it("converte data.id para minúsculas antes de assinar (MAI/min não deve mudar o resultado)", () => {
    const ts = String(nowSeconds());
    const manifest = `id:pay_123abc;request-id:req-1;ts:${ts};`;
    const v1 = sign(manifest);
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: "PAY_123ABC", secret: SECRET }),
    ).toBe(true);
  });

  it("omite o par `request-id` do manifest quando o header x-request-id não vem (nunca rejeita só por isso)", () => {
    const ts = String(nowSeconds());
    const manifest = `id:pay_123;ts:${ts};`; // sem "request-id:..."
    const v1 = sign(manifest);
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: null, dataId: "pay_123", secret: SECRET }),
    ).toBe(true);
  });

  it("omite o par `id` do manifest quando data.id não vem", () => {
    const ts = String(nowSeconds());
    const manifest = `request-id:req-1;ts:${ts};`; // sem "id:..."
    const v1 = sign(manifest);
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId: null, secret: SECRET }),
    ).toBe(true);
  });

  it("rejeita quando a assinatura foi calculada incluindo um par que deveria ter sido omitido", () => {
    const ts = String(nowSeconds());
    // Assinado como se request-id estivesse presente, mas a notificação real não trouxe o header.
    const manifest = `id:pay_123;request-id:req-1;ts:${ts};`;
    const v1 = sign(manifest);
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: null, dataId: "pay_123", secret: SECRET }),
    ).toBe(false);
  });

  it("rejeita ts fora da janela de tolerância (replay de um header capturado)", () => {
    const staleTs = String(nowSeconds() - 20 * 60); // 20 min atrás — fora da janela de 10 min
    const manifest = `id:pay_123;request-id:req-1;ts:${staleTs};`;
    const v1 = sign(manifest);
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${staleTs},v1=${v1}`, xRequestId: "req-1", dataId: "pay_123", secret: SECRET }),
    ).toBe(false);
  });

  it("aceita ts dentro da janela de tolerância (poucos segundos de atraso de rede)", () => {
    const recentTs = String(nowSeconds() - 30);
    const manifest = `id:pay_123;request-id:req-1;ts:${recentTs};`;
    const v1 = sign(manifest);
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${recentTs},v1=${v1}`, xRequestId: "req-1", dataId: "pay_123", secret: SECRET }),
    ).toBe(true);
  });

  it("rejeita v1 incorreto", () => {
    const ts = String(nowSeconds());
    expect(
      verifyMercadoPagoSignature({ xSignature: `ts=${ts},v1=deadbeef`, xRequestId: "req-1", dataId: "pay_123", secret: SECRET }),
    ).toBe(false);
  });

  it("rejeita quando falta o header x-signature inteiro", () => {
    expect(verifyMercadoPagoSignature({ xSignature: null, xRequestId: "req-1", dataId: "pay_123", secret: SECRET })).toBe(false);
  });

  it("rejeita quando falta ts ou v1 dentro do header", () => {
    expect(verifyMercadoPagoSignature({ xSignature: "v1=abc", xRequestId: "req-1", dataId: "pay_123", secret: SECRET })).toBe(false);
    expect(verifyMercadoPagoSignature({ xSignature: "ts=123", xRequestId: "req-1", dataId: "pay_123", secret: SECRET })).toBe(false);
  });
});

describe("explainMercadoPagoSignature — motivo da rejeição (diagnóstico)", () => {
  const base = { xRequestId: "req-1", dataId: "pay_1", secret: SECRET };

  it("devolve null quando válida", () => {
    const ts = String(nowSeconds());
    const v1 = sign(`id:pay_1;request-id:req-1;ts:${ts};`);
    expect(explainMercadoPagoSignature({ ...base, xSignature: `ts=${ts},v1=${v1}` })).toBeNull();
  });

  it("missing_signature quando o header não vem", () => {
    expect(explainMercadoPagoSignature({ ...base, xSignature: null })).toBe("missing_signature");
  });

  it("malformed_signature quando falta ts ou v1", () => {
    expect(explainMercadoPagoSignature({ ...base, xSignature: "v1=abc" })).toBe("malformed_signature");
    expect(explainMercadoPagoSignature({ ...base, xSignature: "ts=abc,v1=abc" })).toBe("malformed_signature");
  });

  it("stale_timestamp quando o ts está fora da tolerância", () => {
    const ts = String(nowSeconds() - 3600);
    const v1 = sign(`id:pay_1;request-id:req-1;ts:${ts};`);
    expect(explainMercadoPagoSignature({ ...base, xSignature: `ts=${ts},v1=${v1}` })).toBe("stale_timestamp");
  });

  it("bad_signature quando o hash não bate (segredo errado)", () => {
    const ts = String(nowSeconds());
    expect(explainMercadoPagoSignature({ ...base, xSignature: `ts=${ts},v1=${"0".repeat(64)}` })).toBe("bad_signature");
  });
});
