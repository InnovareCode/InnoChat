import { normalizeDocumentDigits } from "@/core/billing/document";

/**
 * Máscara de exibição de CPF/CNPJ enquanto o usuário digita — alterna automaticamente conforme
 * a quantidade de dígitos (até 11 = CPF, mais que isso = CNPJ), igual ao pedido do dono. A
 * validação de verdade (dígito verificador) continua em `@/core/billing/document`
 * (`validateCpfCnpj`) — isto aqui é só apresentação, nunca decide se o documento é válido.
 */
export function maskCpfCnpj(raw: string): string {
  const digits = normalizeDocumentDigits(raw).slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
