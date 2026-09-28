/**
 * Formatação de telefone só para exibição — o valor real trafega sempre em E.164
 * (`+5511999999999`, `src/core/whatsapp/phone.ts`). Nunca usar isso para validar ou comparar,
 * só para o usuário ler mais fácil na tela.
 */
export function formatPhoneDisplay(phoneE164: string): string {
  const digits = phoneE164.replace(/^\+/, "");

  // Brasil (+55): DDI + DDD (2) + número (8 ou 9 dígitos) — caso mais comum no InnoChat.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const middle = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `+55 (${ddd}) ${middle}-${end}`;
  }

  // Fora do Brasil ou formato inesperado: devolve com "+" e um espaço depois do DDI, sem
  // inventar um agrupamento que pode estar errado para outros países.
  return `+${digits}`;
}
