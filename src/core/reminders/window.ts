import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Regras puras do lembrete de véspera ao cliente final (sem I/O) — o job
 * (`src/modules/reminders/tick.ts`) só orquestra.
 */

/** Não adianta lembrar de quem tem horário em menos de 2h (já em cima da hora). */
export const REMINDER_MIN_LEAD_HOURS = 2;
export const REMINDER_MIN_HOURS_BEFORE = 2;
export const REMINDER_MAX_HOURS_BEFORE = 48;
/** Horário de silêncio: só envia com a hora local da empresa em [08:00, 21:00). */
export const REMINDER_QUIET_START_HOUR = 8;
export const REMINDER_QUIET_END_HOUR = 21;

const HOUR_MS = 60 * 60 * 1000;

/** `true` se a hora local da empresa está na janela de envio (08:00 inclusive .. 21:00 exclusive). */
export function isInsideSendWindow(now: Date, timezone: string): boolean {
  const hour = Number(formatInTimeZone(now, timezone, "H"));
  return hour >= REMINDER_QUIET_START_HOUR && hour < REMINDER_QUIET_END_HOUR;
}

/** Faixa de `startsAt` elegível agora: `(now + 2h, now + hoursBefore]`. */
export function reminderStartsAtRange(now: Date, hoursBefore: number): { gt: Date; lte: Date } {
  return {
    gt: new Date(now.getTime() + REMINDER_MIN_LEAD_HOURS * HOUR_MS),
    lte: new Date(now.getTime() + hoursBefore * HOUR_MS),
  };
}

const WEEKDAYS_PT = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** "hoje", "amanhã" ou "sexta-feira, 03/10" — pelo calendário do fuso da empresa. */
export function whenLabel(startsAt: Date, now: Date, timezone: string): string {
  const day = formatInTimeZone(startsAt, timezone, "yyyy-MM-dd");
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  if (day === today) return "hoje";
  // Amanhã pelo calendário local: soma 1 dia ao "hoje" local (ao meio-dia UTC, imune a DST).
  const tomorrow = formatInTimeZone(addDays(new Date(`${today}T12:00:00Z`), 1), "UTC", "yyyy-MM-dd");
  if (day === tomorrow) return "amanhã";
  const weekday = WEEKDAYS_PT[Number(formatInTimeZone(startsAt, timezone, "i")) % 7];
  return `${weekday}, ${formatInTimeZone(startsAt, timezone, "dd/MM")}`;
}

/** Primeiro nome para o "Olá, {nome}" — sem nome cadastrado, "cliente". */
export function reminderFirstName(name: string | null | undefined, pushName: string | null | undefined): string {
  const raw = (name?.trim() || pushName?.trim() || "").split(/\s+/)[0] ?? "";
  return raw || "cliente";
}
