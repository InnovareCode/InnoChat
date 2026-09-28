/**
 * Mascara um segredo para exibição na UI (docs/arquitetura.md §5, §11 — "todos os campos
 * sensíveis mascarados"): mostra só os últimos 4 caracteres, nunca o valor em texto puro.
 * `null`/`undefined`/string vazia → `null` (campo não configurado, nada a mascarar).
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return "••••";
  return `••••${value.slice(-4)}`;
}
