import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMercadoPagoSignature } from "./mercadopago";

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
