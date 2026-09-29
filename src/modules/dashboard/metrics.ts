import { formatInTimeZone } from "date-fns-tz";

/**
 * Cálculos puros do "Início" (docs/design/premium-spec.md §10) — sem banco, sem `Date.now()`
 * implícito (a "hora atual" sempre entra por parâmetro). Isso é o que torna estas funções
 * testáveis sem mock de Prisma (ver `metrics.test.ts`); a leitura do banco fica em `queries.ts`.
 */

export type AppointmentMetricRow = {
  startsAt: Date | string;
  status: "SCHEDULED" | "COMPLETED" | "NO_SHOW" | "CANCELED";
  source: "WHATSAPP" | "PANEL";
};

function dateKey(startsAt: Date | string, timezone: string): string {
  return formatInTimeZone(new Date(startsAt), timezone, "yyyy-MM-dd");
}

/** Agendamentos não cancelados cujo dia (no fuso do tenant) é exatamente `todayISO`. */
export function countAppointmentsOnDay(rows: AppointmentMetricRow[], dayISO: string, timezone: string): number {
  return rows.filter((r) => r.status !== "CANCELED" && dateKey(r.startsAt, timezone) === dayISO).length;
}

/** Agendamentos não cancelados nos próximos `days` dias a partir de `fromISO` (inclusive). */
export function countAppointmentsInNextDays(
  rows: AppointmentMetricRow[],
  fromISO: string,
  days: number,
  timezone: string,
): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = from + days * 24 * 60 * 60 * 1000;
  return rows.filter((r) => {
    if (r.status === "CANCELED") return false;
    const key = dateKey(r.startsAt, timezone);
    const t = new Date(`${key}T00:00:00Z`).getTime();
    return t >= from && t < to;
  }).length;
}

/**
 * Taxa de faltas (%) — `NO_SHOW / (COMPLETED + NO_SHOW)`, arredondada. `0` quando não há
 * denominador (nenhum atendimento concluído ou faltado ainda) — nunca `NaN`/divisão por zero
 * silenciosa vazando pra UI.
 */
export function noShowRatePercent(rows: AppointmentMetricRow[]): number {
  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  const noShow = rows.filter((r) => r.status === "NO_SHOW").length;
  const denominator = completed + noShow;
  if (denominator === 0) return 0;
  return Math.round((noShow / denominator) * 100);
}

/**
 * % dos agendamentos (não cancelados) que vieram do bot (`source: WHATSAPP`) em vez do painel.
 * `0` quando não há nenhum agendamento no período — mesma regra de não vazar `NaN`.
 */
export function botSharePercent(rows: AppointmentMetricRow[]): number {
  const valid = rows.filter((r) => r.status !== "CANCELED");
  if (valid.length === 0) return 0;
  const viaBot = valid.filter((r) => r.source === "WHATSAPP").length;
  return Math.round((viaBot / valid.length) * 100);
}

export type DailyPoint = { date: string; count: number };

/**
 * Série diária (não cancelados) cobrindo exatamente `days` dias terminando em `endISO`
 * (inclusive) — sempre com TODOS os dias presentes, mesmo com `count: 0` (o gráfico não pode
 * ter buracos silenciosos onde não houve agendamento).
 */
export function buildDailySeries(rows: AppointmentMetricRow[], endISO: string, days: number, timezone: string): DailyPoint[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.status === "CANCELED") continue;
    const key = dateKey(r.startsAt, timezone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const end = new Date(`${endISO}T00:00:00Z`);
  const series: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return series;
}
