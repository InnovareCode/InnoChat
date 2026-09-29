import { afterEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: headersMock }));

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ platformSettings: { findUnique: findUniqueMock, upsert: upsertMock } }),
}));

const { getPublicBaseUrl, tryGetPublicBaseUrl, ensurePublicBaseUrlFromCurrentRequest } = await import("../public-url");

function headerMap(entries: Record<string, string>) {
  return { get: (key: string) => entries[key] ?? null };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getPublicBaseUrl", () => {
  it("deriva de x-forwarded-proto/x-forwarded-host quando presentes", async () => {
    headersMock.mockResolvedValue(headerMap({ "x-forwarded-proto": "https", "x-forwarded-host": "app.innochat.com.br" }));
    await expect(getPublicBaseUrl()).resolves.toBe("https://app.innochat.com.br");
  });

  it("cai para `host` e assume https quando não há x-forwarded-*", async () => {
    headersMock.mockResolvedValue(headerMap({ host: "app.innochat.com.br" }));
    await expect(getPublicBaseUrl()).resolves.toBe("https://app.innochat.com.br");
  });

  it("usa só o primeiro valor quando há múltiplos proxies (lista separada por vírgula)", async () => {
    headersMock.mockResolvedValue(headerMap({ "x-forwarded-proto": "https,http", "x-forwarded-host": "app.innochat.com.br,internal.proxy" }));
    await expect(getPublicBaseUrl()).resolves.toBe("https://app.innochat.com.br");
  });

  it("sem headers() (fora de uma requisição) cai para PlatformSettings.publicBaseUrl", async () => {
    headersMock.mockRejectedValue(new Error("headers() foi chamado fora de uma requisição"));
    findUniqueMock.mockResolvedValue({ publicBaseUrl: "https://salvo-antes.example.com" });
    await expect(getPublicBaseUrl()).resolves.toBe("https://salvo-antes.example.com");
  });

  it("sem requisição e sem publicBaseUrl salvo: lança PUBLIC_URL_UNKNOWN", async () => {
    headersMock.mockRejectedValue(new Error("headers() foi chamado fora de uma requisição"));
    findUniqueMock.mockResolvedValue(null);
    await expect(getPublicBaseUrl()).rejects.toMatchObject({ code: "PUBLIC_URL_UNKNOWN" });
  });
});

describe("tryGetPublicBaseUrl", () => {
  it("nunca lança — devolve null no lugar do erro", async () => {
    headersMock.mockRejectedValue(new Error("sem requisição"));
    findUniqueMock.mockResolvedValue(null);
    await expect(tryGetPublicBaseUrl()).resolves.toBeNull();
  });
});

describe("ensurePublicBaseUrlFromCurrentRequest", () => {
  it("grava quando ainda não há publicBaseUrl salvo", async () => {
    headersMock.mockResolvedValue(headerMap({ "x-forwarded-proto": "https", "x-forwarded-host": "app.innochat.com.br" }));
    findUniqueMock.mockResolvedValue({ publicBaseUrl: null });

    await ensurePublicBaseUrlFromCurrentRequest();

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, create: expect.objectContaining({ publicBaseUrl: "https://app.innochat.com.br" }) }),
    );
  });

  it("atualiza quando o admin passa a operar por outro domínio (troca para o domínio oficial)", async () => {
    headersMock.mockResolvedValue(headerMap({ "x-forwarded-proto": "https", "x-forwarded-host": "novo-dominio.example.com" }));
    findUniqueMock.mockResolvedValue({ publicBaseUrl: "https://dominio-original.example.com" });

    await ensurePublicBaseUrlFromCurrentRequest();

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ publicBaseUrl: "https://novo-dominio.example.com" }) }),
    );
  });

  it("não grava de novo quando o endereço é o mesmo", async () => {
    headersMock.mockResolvedValue(headerMap({ "x-forwarded-proto": "https", "x-forwarded-host": "app.innochat.com.br" }));
    findUniqueMock.mockResolvedValue({ publicBaseUrl: "https://app.innochat.com.br" });

    await ensurePublicBaseUrlFromCurrentRequest();

    expect(upsertMock).not.toHaveBeenCalled();
  });
});
