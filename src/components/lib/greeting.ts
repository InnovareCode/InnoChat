import { formatInTimeZone } from "date-fns-tz";
import { capitalizeFirst } from "./format-date";

/** "Bom dia" (05h–11h59), "Boa tarde" (12h–17h59), "Boa noite" (18h–04h59) — pela hora NO FUSO da empresa. */
export function greetingForHour(hour: number): "Bom dia" | "Boa tarde" | "Boa noite" {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function greetingAt(now: Date, timezone: string): "Bom dia" | "Boa tarde" | "Boa noite" {
  return greetingForHour(Number(formatInTimeZone(now, timezone, "H")));
}

/**
 * O usuário não tem nome cadastrado: usa a parte local, primeiro trecho antes de
 * `.`/`_`/`-`/`+`/dígito, com a primeira letra maiúscula ("maria.silva@x.com" → "Maria").
 * Devolve `null` quando o resultado não parece um nome (curto demais) — quem chama cai em
 * "Boa tarde!" sem nome, em vez de "Boa tarde, D".
 */
export function firstNameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._\-+\d]/)[0] ?? "";
  if (first.length < 2) return null;
  return capitalizeFirst(first.toLowerCase());
}

/**
 * Primeiro nome de um nome de exibição ("Maria da Silva" → "Maria"). `null` se vazio — quem
 * chama cai no fallback pelo e-mail (`firstNameFromEmail`).
 */
export function firstNameOf(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  return first.length > 0 ? first : null;
}
