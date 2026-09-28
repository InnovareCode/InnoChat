import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn() },
}));

const { testEvolutionConnection, testMercadoPagoConnection, testN8nConnection, testSmtpConnection } = await import("../connection-tests");
const nodemailer = await import("nodemailer");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("testEvolutionConnection", () => {
  it("ok quando a Evolution responde 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200)));
    const result = await testEvolutionConnection("https://evolution.example.com", "chave-secreta");
    expect(result.ok).toBe(true);
  });

  it("distingue chave rejeitada (401) de outro erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401)));
    const result = await testEvolutionConnection("https://evolution.example.com", "chave-errada");
    expect(result.ok).toBe(false);
    expect(result.detalhe).toContain("rejeitada");
    expect(result.detalhe).not.toContain("chave-errada");
  });

  it("nunca vaza a API key na resposta, mesmo em erro de rede", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED — apikey=chave-secreta-nao-deve-aparecer");
      }),
    );
    const result = await testEvolutionConnection("https://evolution.example.com", "chave-secreta-nao-deve-aparecer");
    expect(result.ok).toBe(false);
    expect(result.detalhe).not.toContain("chave-secreta-nao-deve-aparecer");
  });
});

describe("testMercadoPagoConnection", () => {
  it("ok quando /users/me responde 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200)));
    const result = await testMercadoPagoConnection("access-token");
    expect(result.ok).toBe(true);
  });

  it("401 vira mensagem específica de token inválido", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401)));
    const result = await testMercadoPagoConnection("access-token-invalido");
    expect(result.ok).toBe(false);
    expect(result.detalhe).toContain("inválido");
  });
});

describe("testN8nConnection", () => {
  it("ok quando /api/v1/workflows responde 200", async () => {
    const fetchMock = vi.fn<(url: string | URL, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await testN8nConnection("https://n8n.example.com", "n8n-key");
    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://n8n.example.com/api/v1/workflows?limit=1");
    expect(init?.headers).toMatchObject({ "X-N8N-API-KEY": "n8n-key" });
  });

  it("403 vira mensagem de API key rejeitada", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(403)));
    const result = await testN8nConnection("https://n8n.example.com", "n8n-key-errada");
    expect(result.ok).toBe(false);
    expect(result.detalhe).toContain("rejeitada");
  });
});

describe("testSmtpConnection", () => {
  it("ok quando transporter.verify() resolve", async () => {
    const verify = vi.fn().mockResolvedValue(true);
    vi.mocked(nodemailer.default.createTransport).mockReturnValue({ verify } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

    const result = await testSmtpConnection({ host: "smtp.example.com", port: 587, secure: false, user: "user", password: "pass" });
    expect(result.ok).toBe(true);
    expect(verify).toHaveBeenCalledOnce();
  });

  it("erro de autenticação vira mensagem legível, sem a senha", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("535 authentication failed for password=segredo-nao-deve-aparecer"));
    vi.mocked(nodemailer.default.createTransport).mockReturnValue({ verify } as unknown as ReturnType<typeof nodemailer.default.createTransport>);

    const result = await testSmtpConnection({ host: "smtp.example.com", port: 587, secure: false, user: "user", password: "segredo-nao-deve-aparecer" });
    expect(result.ok).toBe(false);
    expect(result.detalhe).not.toContain("segredo-nao-deve-aparecer");
  });
});
