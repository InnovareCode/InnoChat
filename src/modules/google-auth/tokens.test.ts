import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "unit-test-secret-com-mais-de-16-chars";
});

const { signGoogleToken, verifyGoogleToken } = await import("./tokens");

describe("tokens do login com Google", () => {
  it("assina e verifica, devolvendo os dados", () => {
    const token = signGoogleToken("google-signup", { email: "a@b.com", sub: "123", name: "Ana" }, 60_000);
    const claims = verifyGoogleToken<{ email: string; sub: string }>("google-signup", token);
    expect(claims.email).toBe("a@b.com");
    expect(claims.sub).toBe("123");
  });

  it("recusa token de outra finalidade", () => {
    const token = signGoogleToken("google-login", { userId: "u1" }, 60_000);
    expect(() => verifyGoogleToken("google-signup", token)).toThrow(expect.objectContaining({ code: "TOKEN_INVALID" }));
  });

  it("recusa corpo adulterado e assinatura errada", () => {
    const token = signGoogleToken("google-signup", { email: "a@b.com", sub: "1" }, 60_000);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ email: "admin@x.com", sub: "1", purpose: "google-signup", exp: 9999999999 })).toString("base64url");
    expect(() => verifyGoogleToken("google-signup", `${forged}.${sig}`)).toThrow(expect.objectContaining({ code: "TOKEN_INVALID" }));
    expect(() => verifyGoogleToken("google-signup", `${body}.abc`)).toThrow(expect.objectContaining({ code: "TOKEN_INVALID" }));
    expect(() => verifyGoogleToken("google-signup", "lixo")).toThrow(expect.objectContaining({ code: "TOKEN_INVALID" }));
  });

  it("recusa token expirado com TOKEN_EXPIRED", () => {
    const token = signGoogleToken("google-signup", { email: "a@b.com", sub: "1" }, 1_000, Date.now() - 60_000);
    expect(() => verifyGoogleToken("google-signup", token)).toThrow(expect.objectContaining({ code: "TOKEN_EXPIRED" }));
  });

  it("recusa token assinado com outro AUTH_SECRET", () => {
    const token = signGoogleToken("google-signup", { email: "a@b.com", sub: "1" }, 60_000);
    process.env.AUTH_SECRET = "outro-secret-completamente-diferente-123";
    expect(() => verifyGoogleToken("google-signup", token)).toThrow(expect.objectContaining({ code: "TOKEN_INVALID" }));
    process.env.AUTH_SECRET = "unit-test-secret-com-mais-de-16-chars";
  });
});
