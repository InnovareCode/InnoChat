import { describe, expect, it } from "vitest";
import { normalizePhoneFromJid } from "../phone";

describe("normalizePhoneFromJid", () => {
  it("adiciona o 9º dígito quando o JID BR vem com 8 dígitos no assinante", () => {
    expect(normalizePhoneFromJid("558499727583@s.whatsapp.net")).toBe("+5584999727583");
  });

  it("não altera um JID BR que já tem 9 dígitos no assinante", () => {
    expect(normalizePhoneFromJid("5584999727583@s.whatsapp.net")).toBe("+5584999727583");
  });

  it("não altera número de fora do Brasil (prefixo diferente de 55)", () => {
    expect(normalizePhoneFromJid("12025550123@s.whatsapp.net")).toBe("+12025550123");
  });

  it("devolve null para JID vazio ou sem dígitos", () => {
    expect(normalizePhoneFromJid("")).toBeNull();
    expect(normalizePhoneFromJid(null)).toBeNull();
    expect(normalizePhoneFromJid(undefined)).toBeNull();
    expect(normalizePhoneFromJid("@s.whatsapp.net")).toBeNull();
  });

  it("não mexe em JID malformado (DDD incompleto)", () => {
    expect(normalizePhoneFromJid("551@s.whatsapp.net")).toBe("+551");
  });
});
