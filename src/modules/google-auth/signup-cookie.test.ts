import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
const set = vi.fn((name: string, value: string) => void store.set(name, value));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (store.has(n) ? { value: store.get(n)! } : undefined), set, delete: (n: string) => void store.delete(n) }),
}));

const { GOOGLE_SIGNUP_COOKIE, assertGoogleSignupCookie, clearGoogleSignupCookie, hashSignupToken, setGoogleSignupCookie } = await import("./signup-cookie");

beforeEach(() => {
  store.clear();
  set.mockClear();
});

describe("cookie de vínculo do token de cadastro (S1)", () => {
  it("grava o HASH do token (não o token) httpOnly, lax, com TTL de 10 min", async () => {
    await setGoogleSignupCookie("token-abc");
    const [name, value, options] = set.mock.calls[0]! as unknown as [string, string, Record<string, unknown>];
    expect(name).toBe(GOOGLE_SIGNUP_COOKIE);
    expect(value).toBe(hashSignupToken("token-abc"));
    expect(value).not.toContain("token-abc");
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  });

  it("aceita quando o cookie bate com o token", async () => {
    await setGoogleSignupCookie("token-abc");
    await expect(assertGoogleSignupCookie("token-abc")).resolves.toBeUndefined();
  });

  it("recusa sem cookie (token vazado em outro navegador) com TOKEN_INVALID", async () => {
    await expect(assertGoogleSignupCookie("token-abc")).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("recusa cookie de OUTRO token", async () => {
    await setGoogleSignupCookie("token-abc");
    await expect(assertGoogleSignupCookie("token-xyz")).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("clear apaga o cookie", async () => {
    await setGoogleSignupCookie("token-abc");
    await clearGoogleSignupCookie();
    await expect(assertGoogleSignupCookie("token-abc")).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });
});
