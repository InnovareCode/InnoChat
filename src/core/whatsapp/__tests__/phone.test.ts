import { describe, expect, it } from "vitest";
import { normalizePhoneFromJid, parseBrazilianPhoneToE164, phoneE164ToLikelyWhatsappJid } from "../phone";

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

describe("parseBrazilianPhoneToE164", () => {
  it("aceita número formatado com parênteses/espaço/hífen, sem DDI, e adiciona o 9º dígito", () => {
    expect(parseBrazilianPhoneToE164("(84) 9972-7583")).toBe("+5584999727583");
  });

  it("aceita número já com 9 dígitos, sem alterar", () => {
    expect(parseBrazilianPhoneToE164("84999727583")).toBe("+5584999727583");
  });

  it("aceita DDI +55 já digitado", () => {
    expect(parseBrazilianPhoneToE164("+55 84 99972-7583")).toBe("+5584999727583");
  });

  it("devolve null para entrada vazia ou com poucos dígitos (nem DDD completo)", () => {
    expect(parseBrazilianPhoneToE164("")).toBeNull();
    expect(parseBrazilianPhoneToE164("123")).toBeNull();
  });
});

describe("phoneE164ToLikelyWhatsappJid", () => {
  it("remove o 9º dígito de um E.164 BR de celular (caso mais comum no remoteJid real)", () => {
    expect(phoneE164ToLikelyWhatsappJid("+5584999727583")).toBe("558499727583@s.whatsapp.net");
  });

  it("não mexe em número fora do Brasil", () => {
    expect(phoneE164ToLikelyWhatsappJid("+12025550123")).toBe("12025550123@s.whatsapp.net");
  });
});
