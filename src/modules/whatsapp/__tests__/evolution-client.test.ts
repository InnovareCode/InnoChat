import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvolutionClient, EvolutionApiError } from "../evolution-client";

/**
 * ⚠️ HONESTIDADE SOBRE O QUE FOI VERIFICADO: os corpos de resposta abaixo são fixtures baseadas
 * na documentação pública da Evolution API v2 e no adaptador validado ao vivo do InnoAtendente
 * (2026-09-04) — **NÃO capturados de um servidor Evolution real do InnoChat** (mesma ressalva
 * de `evolution-client.ts` e `fixtures/evolution/README.md`).
 */

const BASE_URL = "https://evolution.example.com";
const API_KEY = "test-api-key";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("createEvolutionClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("createInstance chama POST /instance/create com o corpo esperado", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ instance: { instanceName: "innochat-studio-x7k2" } }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    await client.createInstance("innochat-studio-x7k2");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/instance/create`);
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe(API_KEY);
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ instanceName: "innochat-studio-x7k2", integration: "WHATSAPP-BAILEYS", qrcode: true });
  });

  it("setWebhook envia os eventos MESSAGES_UPSERT e CONNECTION_UPDATE, byEvents/base64 false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ webhook: { enabled: true } }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    await client.setWebhook("innochat-studio-x7k2", "https://n8n.example.com/webhook/innochat/evolution/token123");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/webhook/set/innochat-studio-x7k2`);
    const body = JSON.parse(init.body);
    expect(body.webhook).toMatchObject({
      enabled: true,
      url: "https://n8n.example.com/webhook/innochat/evolution/token123",
      byEvents: false,
      base64: false,
    });
    expect(body.webhook.events).toEqual(["MESSAGES_UPSERT", "CONNECTION_UPDATE"]);
  });

  it("connect() extrai o QR de base64 direto", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ base64: "iVBORw0KGgo=", pairingCode: "ABCD-1234" }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    const result = await client.connect("innochat-studio-x7k2");

    expect(result.qrCodeDataUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(result.pairingCode).toBe("ABCD-1234");
  });

  it("connect() extrai o QR de qrcode.base64 quando a forma direta não existe", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ qrcode: { base64: "iVBORw0KGgo=" } }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    const result = await client.connect("innochat-studio-x7k2");

    expect(result.qrCodeDataUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(result.pairingCode).toBeNull();
  });

  it("connect() já aceita uma data URL completa sem duplicar o prefixo", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ base64: "data:image/png;base64,iVBORw0KGgo=" }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    const result = await client.connect("innochat-studio-x7k2");

    expect(result.qrCodeDataUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("connect() devolve qrCodeDataUrl null quando a instância já está conectada (sem QR)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    const result = await client.connect("innochat-studio-x7k2");

    expect(result.qrCodeDataUrl).toBeNull();
  });

  it("connectionState() lê instance.state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ instance: { instanceName: "innochat-studio-x7k2", state: "open" } }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    expect(await client.connectionState("innochat-studio-x7k2")).toBe("open");
  });

  it("connectionState() cai para 'close' quando a resposta não traz state nenhum", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    expect(await client.connectionState("innochat-studio-x7k2")).toBe("close");
  });

  it("fetchOwnerJid() lê ownerJid de um array de instâncias", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ ownerJid: "5584999727583@s.whatsapp.net" }]));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    expect(await client.fetchOwnerJid("innochat-studio-x7k2")).toBe("5584999727583@s.whatsapp.net");
  });

  it("fetchOwnerJid() devolve null quando não há instância nenhuma na resposta", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    expect(await client.fetchOwnerJid("innochat-studio-x7k2")).toBeNull();
  });

  it("logout() chama DELETE /instance/logout/{instance}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    await client.logout("innochat-studio-x7k2");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/instance/logout/innochat-studio-x7k2`);
    expect(init.method).toBe("DELETE");
  });

  it("deleteInstance() chama DELETE /instance/delete/{instance}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    await client.deleteInstance("innochat-studio-x7k2");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE_URL}/instance/delete/innochat-studio-x7k2`);
    expect(init.method).toBe("DELETE");
  });

  it("lança EvolutionApiError em 4xx SEM retentar (erro do nosso lado)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 400 }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    await expect(client.createInstance("innochat-studio-x7k2")).rejects.toBeInstanceOf(EvolutionApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retenta em 5xx até 3 tentativas e depois lança", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 503 }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    await expect(client.createInstance("innochat-studio-x7k2")).rejects.toBeInstanceOf(EvolutionApiError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retenta em erro de rede/timeout e uma tentativa seguinte com sucesso resolve", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down")).mockResolvedValueOnce(jsonResponse({}));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    await expect(client.createInstance("innochat-studio-x7k2")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("nunca inclui o corpo de erro da Evolution na mensagem da exceção (pode ecoar PII)", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "telefone inválido: +5511999999999" }), { status: 400 }));
    const client = createEvolutionClient(BASE_URL, API_KEY);

    await expect(client.createInstance("innochat-studio-x7k2")).rejects.toThrowError(
      expect.not.stringContaining("+5511999999999"),
    );
  });
});
