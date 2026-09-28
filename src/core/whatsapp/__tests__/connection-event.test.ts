import { describe, expect, it } from "vitest";
import { parseConnectionEvent } from "../connection-event";

describe("parseConnectionEvent", () => {
  it("reconhece open → CONNECTED com ownerJid", () => {
    const event = parseConnectionEvent({
      event: "connection.update",
      instance: "innochat-studio-bela-x7k2",
      data: { state: "open", wuid: "5584999727583@s.whatsapp.net" },
    });
    expect(event).toEqual({ state: "CONNECTED", ownerJid: "5584999727583@s.whatsapp.net" });
  });

  it("reconhece connecting → QRCODE sem ownerJid", () => {
    const event = parseConnectionEvent({
      event: "CONNECTION_UPDATE",
      instance: "innochat-studio-bela-x7k2",
      data: { state: "connecting" },
    });
    expect(event).toEqual({ state: "QRCODE", ownerJid: null });
  });

  it("reconhece close/closed → DISCONNECTED", () => {
    for (const state of ["close", "closed"]) {
      const event = parseConnectionEvent({
        event: "connection.update",
        instance: "inst",
        data: { state },
      });
      expect(event?.state).toBe("DISCONNECTED");
      expect(event?.ownerJid).toBeNull();
    }
  });

  it("ignora o campo `instance` do corpo — quem chama já resolveu a instância pelo webhookToken", () => {
    // Sem `instance` nenhum no corpo: continua reconhecendo o evento normalmente (docs/contratos.md
    // §6.1 — o tenantId/instância nunca vêm do corpo; a Fase 4 já testa isso passando só `{event,data}`).
    const event = parseConnectionEvent({ event: "connection.update", data: { state: "open", wuid: "x@s.whatsapp.net" } });
    expect(event).toEqual({ state: "CONNECTED", ownerJid: "x@s.whatsapp.net" });
  });

  it("devolve null para evento que não é connection.update", () => {
    expect(parseConnectionEvent({ event: "messages.upsert", instance: "inst", data: {} })).toBeNull();
  });

  it("devolve null para state desconhecido", () => {
    expect(
      parseConnectionEvent({ event: "connection.update", instance: "inst", data: { state: "banana" } }),
    ).toBeNull();
  });

  it("devolve null para payload irreconhecível (nunca lança)", () => {
    expect(parseConnectionEvent(null)).toBeNull();
    expect(parseConnectionEvent(undefined)).toBeNull();
    expect(parseConnectionEvent("garbage")).toBeNull();
    expect(parseConnectionEvent([])).toBeNull();
    expect(parseConnectionEvent({})).toBeNull();
    expect(parseConnectionEvent({ event: "connection.update", data: {} })).toBeNull(); // sem state reconhecido
  });
});
