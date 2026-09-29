import { formatInTimeZone } from "date-fns-tz";

/**
 * Formatação de data/hora do painel, centralizada aqui para nunca repetir
 * `toLocaleDateString`/`toLocaleTimeString` cru pelos componentes — cada
 * ponto que precisar de rótulo de data/hora usa uma função daqui.
 *
 * Armadilha resolvida (não repetir): o `Intl`/`toLocaleDateString("pt-BR")`
 * já devolve "segunda-feira, 5 de outubro" (minúsculo, sem zero à esquerda no
 * dia) — o bug de "Segunda-Feira, 05 De Outubro" que apareceu na Fase 2 não
 * era do `Intl`, era da classe utilitária `capitalize` do Tailwind, que
 * deixa MAIÚSCULA a primeira letra de CADA palavra (`text-transform:
 * capitalize`), não só a primeira da frase. A correção é capitalizar só a
 * primeira letra da string inteira em JS (`capitalizeFirst`), nunca via CSS
 * `capitalize`/`uppercase` em cima de uma data por extenso.
 */

const UTC_TZ = "UTC";

/** Deixa maiúscula só a primeira letra da string (nunca via CSS `capitalize`). */
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function parseDateOnlyUTC(dateISO: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * "segunda-feira, 5 de outubro" — dia por extenso, sem zero à esquerda.
 * `capitalize: true` (padrão) deixa maiúscula a primeira letra, para uso
 * como rótulo isolado (não no meio de uma frase minúscula).
 */
export function formatLongDateLabel(dateISO: string, options: { capitalize?: boolean } = {}): string {
  const { capitalize = true } = options;
  const label = parseDateOnlyUTC(dateISO).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: UTC_TZ,
  });
  return capitalize ? capitalizeFirst(label) : label;
}

/** "seg." / "ter." — abreviado, para cabeçalho de coluna e listas compactas. */
export function formatShortWeekdayLabel(dateISO: string, options: { capitalize?: boolean } = {}): string {
  const { capitalize = false } = options;
  const label = parseDateOnlyUTC(dateISO).toLocaleDateString("pt-BR", {
    weekday: "short",
    timeZone: UTC_TZ,
  });
  return capitalize ? capitalizeFirst(label) : label;
}

/** "5" — só o número do dia, sem zero à esquerda, para o número grande da coluna. */
export function formatDayNumber(dateISO: string): string {
  return parseDateOnlyUTC(dateISO).toLocaleDateString("pt-BR", { day: "numeric", timeZone: UTC_TZ });
}

/**
 * "Semana de 28 set – 4 out" (ou "28 dez de 2026 – 3 jan de 2027" quando a
 * semana cruza o ano). `startISO` é o primeiro dia (segunda-feira) da semana.
 */
export function formatWeekRangeLabel(startISO: string, endISO: string): string {
  const start = parseDateOnlyUTC(startISO);
  const end = parseDateOnlyUTC(endISO);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();

  const dayMonth = (d: Date) =>
    d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", timeZone: UTC_TZ }).replace(".", "");

  if (sameYear) {
    return `Semana de ${dayMonth(start)} – ${dayMonth(end)}`;
  }
  const withYear = (d: Date) =>
    `${dayMonth(d)} de ${d.getUTCFullYear()}`;
  return `Semana de ${withYear(start)} – ${withYear(end)}`;
}

/** "14:30" no fuso do tenant. */
export function formatTimeLabel(iso: string | Date, timezone: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return formatInTimeZone(date, timezone, "HH:mm");
}

/** "05/10/2026, 14:30" no fuso do tenant. */
export function formatDateTimeLabel(iso: string | Date, timezone: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return formatInTimeZone(date, timezone, "dd/MM/yyyy, HH:mm");
}

/** "05/10, 14:30" — versão compacta para colunas de tabela. */
export function formatDateTimeShortLabel(iso: string | Date, timezone: string): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return formatInTimeZone(date, timezone, "dd/MM, HH:mm");
}

/**
 * Nomes de fuso amigáveis para exibir na UI — nunca o identificador IANA
 * técnico ("America/Sao_Paulo") direto na tela. Fusos brasileiros comuns têm
 * nome fixo; qualquer outro cai no nome longo do `Intl` (ex.: "Horário
 * Padrão do Pacífico"), que já vem localizado em pt-BR.
 */
const FRIENDLY_TIMEZONE_LABELS: Record<string, string> = {
  "America/Sao_Paulo": "Horário de Brasília",
  "America/Noronha": "Horário de Fernando de Noronha",
  "America/Manaus": "Horário do Amazonas",
  "America/Cuiaba": "Horário de Mato Grosso",
  "America/Rio_Branco": "Horário do Acre",
  "America/Belem": "Horário de Belém",
  "America/Fortaleza": "Horário de Fortaleza",
  "America/Recife": "Horário de Recife",
};

/**
 * "há 12 min" / "há 3h" / "há 2 dias" / "nunca executado" — usado nos cards de "última
 * execução" da tela Admin → Saúde. `null` (nunca rodou) devolve o rótulo de ausência em vez de
 * uma conta relativa a partir de `Date` inválida.
 */
export function formatRelativeTimeLabel(iso: string | null): string {
  if (!iso) return "nunca executado";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "agora mesmo";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

export function friendlyTimezoneLabel(timezone: string): string {
  const known = FRIENDLY_TIMEZONE_LABELS[timezone];
  if (known) return known;
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, timeZoneName: "long" }).formatToParts(
      new Date(),
    );
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    return tzPart?.value ?? timezone;
  } catch {
    return timezone;
  }
}
