/**
 * CPF/CNPJ do pagador (docs/contratos.md, seção Cobrança). Existe porque o Mercado Pago EXIGE
 * `payer.identification` para criar uma cobrança Pix — sem isso ele recusa a criação (ver
 * `mercadopago.ts#buildPayerIdentification`). Confirmado contra o Parque das Feiras
 * (`backend/tests/payments.pix.cpf.test.ts`): lá um comprador sem CPF cadastrado gerava 500 em
 * produção antes da validação existir. Aqui a mesma exigência se aplica ao TENANT (quem assina o
 * plano), não a um comprador — por isso a validação vive em `src/core/billing`, puro, sem tocar
 * banco.
 *
 * Dígitos verificadores calculados pelo algoritmo público de CPF/CNPJ (Receita Federal) — não é
 * código do Parque das Feiras, é a mesma matemática que qualquer implementação de CPF/CNPJ usa.
 */

export type DocumentType = "CPF" | "CNPJ";

export type DocumentValidation = { valid: true; digits: string; type: DocumentType } | { valid: false };

/** Remove tudo que não é dígito — aceita `529.982.247-25` e `52998224725` igualmente. */
export function normalizeDocumentDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function checkDigitsAllEqual(digits: string): boolean {
  return digits.split("").every((d) => d === digits[0]);
}

/** CPF: 11 dígitos, os 2 últimos são verificadores (módulo 11 sobre os 9/10 anteriores). */
export function isValidCpf(digits: string): boolean {
  if (digits.length !== 11 || checkDigitsAllEqual(digits)) return false;

  const calcDigit = (base: string, factorStart: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * (factorStart - i);
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calcDigit(digits.slice(0, 9), 10);
  const d2 = calcDigit(digits.slice(0, 9) + String(d1), 11);
  return digits === digits.slice(0, 9) + String(d1) + String(d2);
}

/** CNPJ: 14 dígitos, os 2 últimos são verificadores (módulo 11 com pesos 5..2,9..2). */
export function isValidCnpj(digits: string): boolean {
  if (digits.length !== 14 || checkDigitsAllEqual(digits)) return false;

  const calcDigit = (base: string): number => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * weights[i]!;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calcDigit(digits.slice(0, 12));
  const d2 = calcDigit(digits.slice(0, 12) + String(d1));
  return digits === digits.slice(0, 12) + String(d1) + String(d2);
}

/**
 * Valida um CPF ou CNPJ em qualquer formatação (com ou sem pontuação) pelo tamanho E pelo
 * dígito verificador — igual ao Parque das Feiras (`payments.pix.cpf.test.ts`, caso "dígito
 * verificador errado é recusado"), nunca só pela contagem de dígitos.
 */
export function validateCpfCnpj(raw: string): DocumentValidation {
  const digits = normalizeDocumentDigits(raw);
  if (digits.length === 11 && isValidCpf(digits)) return { valid: true, digits, type: "CPF" };
  if (digits.length === 14 && isValidCnpj(digits)) return { valid: true, digits, type: "CNPJ" };
  return { valid: false };
}
