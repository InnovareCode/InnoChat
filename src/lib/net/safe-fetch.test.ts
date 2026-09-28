import { afterEach, describe, expect, it, vi } from "vitest";
import { assertSafeExternalUrl, safeFetch, UnsafeUrlError } from "./safe-fetch";

/**
 * Defesa SSRF leve (revisão de segurança 2026-09-28, achado MÉDIA) — deliberadamente NÃO testa
 * bloqueio de IP privado em geral (decisão consciente: Evolution/n8n reais costumam estar na
 * mesma rede interna do Easypanel).
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assertSafeExternalUrl", () => {
  it("aceita http/https normalmente", () => {
    expect(() => assertSafeExternalUrl("https://evolution.example.com")).not.toThrow();
    expect(() => assertSafeExternalUrl("http://192.168.1.50:8080")).not.toThrow();
  });

  it("bloqueia esquemas diferentes de http/https", () => {
    expect(() => assertSafeExternalUrl("file:///etc/passwd")).toThrow(UnsafeUrlError);
    expect(() => assertSafeExternalUrl("ftp://example.com")).toThrow(UnsafeUrlError);
  });

  it("bloqueia o endereço de metadados de nuvem", () => {
    expect(() => assertSafeExternalUrl("http://169.254.169.254/latest/meta-data")).toThrow(UnsafeUrlError);
  });

  it("NÃO bloqueia IP privado em geral (Evolution/n8n podem estar na rede interna)", () => {
    expect(() => assertSafeExternalUrl("http://10.0.0.5:8080")).not.toThrow();
    expect(() => assertSafeExternalUrl("http://172.17.0.3:5678")).not.toThrow();
    expect(() => assertSafeExternalUrl("http://localhost:5678")).not.toThrow();
  });

  it("rejeita URL malformada", () => {
    expect(() => assertSafeExternalUrl("não é uma url")).toThrow(UnsafeUrlError);
  });
});

describe("safeFetch", () => {
  it("chama fetch normalmente quando não há redirect", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await safeFetch("https://n8n.example.com/api/v1/workflows");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("segue redirect para o MESMO host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://n8n.example.com/api/v1/workflows/final" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await safeFetch("https://n8n.example.com/api/v1/workflows");
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bloqueia redirect para um HOST diferente", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("https://n8n.example.com/api/v1/workflows")).rejects.toThrow(UnsafeUrlError);
  });

  it("bloqueia a URL de origem antes de qualquer fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(UnsafeUrlError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
