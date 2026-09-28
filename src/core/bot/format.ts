import { formatInTimeZone } from "date-fns-tz";

/**
 * Rótulos formatados no fuso/locale do tenant (docs/arquitetura.md §3, §6.4 — "o painel já
 * devolve os rótulos formatados"). Puro: só formatação, sem I/O.
 */

const WEEKDAY_ABBR_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Ter 30/09" — dia da semana abreviado + dd/MM, no fuso do tenant. */
export function formatDayLabel(date: Date, timezone: string): string {
  const weekday = Number(formatInTimeZone(date, timezone, "i")); // 1 (segunda) .. 7 (domingo), ISO
  const abbr = WEEKDAY_ABBR_PT[weekday % 7];
  return `${abbr} ${formatInTimeZone(date, timezone, "dd/MM")}`;
}

/** "14:30" — HH:mm no fuso do tenant. */
export function formatTimeLabel(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "HH:mm");
}

/** "R$ 80,00" — `priceCents` nulo/undefined devolve `null` (serviço sem preço, §3: "sem preço, só o nome"). */
export function formatPriceLabel(priceCents: number | null | undefined): string | null {
  if (priceCents === null || priceCents === undefined) return null;
  // `Intl.NumberFormat` devolve NBSP (U+00A0) entre "R$" e o valor — troca por espaço normal:
  // texto vai para o WhatsApp via texto puro, e um NBSP nesse canal é só risco de exibição
  // estranha em algum cliente, sem nenhum ganho.
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(priceCents / 100).replace(/ /g, " ");
}

/** "Corte feminino — R$ 80,00" ou "Corte feminino" (sem preço). */
export function formatServiceLabel(name: string, priceCents: number | null | undefined): string {
  const price = formatPriceLabel(priceCents);
  return price ? `${name} — ${price}` : name;
}
