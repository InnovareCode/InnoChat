import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, ENCRYPTED_PREFIX, isEncryptedSecret } from "./crypto";

const ORIGINAL = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = "segredo-de-teste-com-mais-de-16-chars";
});
afterEach(() => {
  process.env.AUTH_SECRET = ORIGINAL;
});

describe("crypto (AES-256-GCM, chave derivada do AUTH_SECRET)", () => {
  it("ida e volta, com prefixo de versão", () => {
    const enc = encryptSecret("APP_USR-1234-token");
    expect(enc.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(enc).not.toContain("APP_USR");
    expect(isEncryptedSecret(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe("APP_USR-1234-token");
  });

  it("IV aleatório: o mesmo texto vira cifrados diferentes", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  it("formato: iv(12) | tag(16) | ciphertext em base64", () => {
    const raw = Buffer.from(encryptSecret("abc").slice(ENCRYPTED_PREFIX.length), "base64");
    expect(raw.length).toBe(12 + 16 + 3);
  });

  it("adulteração do ciphertext é detectada (null)", () => {
    const enc = encryptSecret("segredo");
    const raw = Buffer.from(enc.slice(ENCRYPTED_PREFIX.length), "base64");
    raw[raw.length - 1] ^= 0xff;
    expect(decryptSecret(ENCRYPTED_PREFIX + raw.toString("base64"))).toBeNull();
  });

  it("adulteração da tag é detectada (null)", () => {
    const raw = Buffer.from(encryptSecret("segredo").slice(ENCRYPTED_PREFIX.length), "base64");
    raw[12] ^= 0x01;
    expect(decryptSecret(ENCRYPTED_PREFIX + raw.toString("base64"))).toBeNull();
  });

  it("chave errada (AUTH_SECRET trocado) => null, fail-closed", () => {
    const enc = encryptSecret("segredo");
    process.env.AUTH_SECRET = "outro-auth-secret-bem-diferente-1234";
    expect(decryptSecret(enc)).toBeNull();
  });

  it("sem AUTH_SECRET: decifrar devolve null e cifrar lança", () => {
    const enc = encryptSecret("segredo");
    delete process.env.AUTH_SECRET;
    expect(decryptSecret(enc)).toBeNull();
    expect(() => encryptSecret("x")).toThrow();
  });

  it("lixo, truncado e texto puro não decifram (null, nunca lançam)", () => {
    expect(decryptSecret("texto puro legado")).toBeNull();
    expect(decryptSecret(ENCRYPTED_PREFIX + "abc")).toBeNull();
    expect(decryptSecret(ENCRYPTED_PREFIX)).toBeNull();
    expect(isEncryptedSecret(null)).toBe(false);
    expect(isEncryptedSecret("APP_USR-123")).toBe(false);
  });
});
