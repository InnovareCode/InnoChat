import { formatInTimeZone } from "date-fns-tz";

/** `1234` → "R$ 12,34". Sempre BRL (docs/arquitetura.md §7.1 — "Ciclo mensal em BRL"). */
export function formatCentsBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBR(date: Date, timezone = "America/Sao_Paulo"): string {
  return formatInTimeZone(date, timezone, "dd/MM/yyyy");
}
