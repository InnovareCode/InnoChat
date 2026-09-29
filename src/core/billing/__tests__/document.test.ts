import { describe, expect, it } from "vitest";
import { validateCpfCnpj, normalizeDocumentDigits, isValidCpf, isValidCnpj } from "../document";

// CPF/CNPJ válidos de teste (mesmos usados pelo Parque das Feiras em payments.pix.cpf.test.ts —
// são números de exemplo públicos, matematicamente válidos, não pertencem a ninguém real).
const CPF_VALIDO = "52998224725";
const CPF_INVALIDO = "52998224724"; // mesmo número com o último dígito trocado
const CNPJ_VALIDO = "11222333000181";

describe("normalizeDocumentDigits", () => {
  it("remove pontuação", () => {
    expect(normalizeDocumentDigits("529.982.247-25")).toBe(CPF_VALIDO);
    expect(normalizeDocumentDigits("11.222.333/0001-81")).toBe(CNPJ_VALIDO);
  });
});

describe("isValidCpf", () => {
  it("aceita CPF com dígito verificador correto", () => {
    expect(isValidCpf(CPF_VALIDO)).toBe(true);
  });

  it("rejeita CPF com dígito verificador errado", () => {
    expect(isValidCpf(CPF_INVALIDO)).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos (ex.: 00000000000)", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(isValidCpf("123")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJ com dígito verificador correto", () => {
    expect(isValidCnpj(CNPJ_VALIDO)).toBe(true);
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(isValidCnpj("11222333000180")).toBe(false);
  });

  it("rejeita sequência de dígitos repetidos", () => {
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

describe("validateCpfCnpj", () => {
  it("reconhece CPF formatado", () => {
    expect(validateCpfCnpj("529.982.247-25")).toEqual({ valid: true, digits: CPF_VALIDO, type: "CPF" });
  });

  it("reconhece CNPJ formatado", () => {
    expect(validateCpfCnpj("11.222.333/0001-81")).toEqual({ valid: true, digits: CNPJ_VALIDO, type: "CNPJ" });
  });

  it("rejeita dígito verificador errado mesmo com tamanho certo", () => {
    expect(validateCpfCnpj(CPF_INVALIDO)).toEqual({ valid: false });
  });

  it("rejeita tamanho que não é 11 nem 14", () => {
    expect(validateCpfCnpj("123456")).toEqual({ valid: false });
  });

  it("rejeita string vazia", () => {
    expect(validateCpfCnpj("")).toEqual({ valid: false });
  });
});
