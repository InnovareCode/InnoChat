/**
 * Remetente dos e-mails (`PlatformSettings.smtpFrom`). Aceita só o e-mail
 * (`no-reply@dominio.com`) ou nome + e-mail (`InnoChat <no-reply@dominio.com>`, com ou sem aspas
 * no nome). Sem nome, o remetente sai como "InnoChat" — antes saía o e-mail cru e o Gmail mostrava
 * "no-reply" na caixa de entrada (pedido do dono, 2026-09-29).
 */

export const DEFAULT_SENDER_NAME = "InnoChat";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
const NAMED_RE = /^\s*"?([^"<>]*?)"?\s*<\s*([^<>\s]+)\s*>\s*$/;

export type ParsedSender = { name: string | null; email: string };

export function parseSender(input: string): ParsedSender | null {
  const value = input.trim();
  if (!value) return null;
  const named = NAMED_RE.exec(value);
  if (named) {
    const name = named[1].trim();
    const email = named[2].trim();
    if (!EMAIL_RE.test(email) || name.length > 80) return null;
    return { name: name || null, email };
  }
  return EMAIL_RE.test(value) ? { name: null, email: value } : null;
}

/** Formato de endereço do nodemailer (`{ name, address }`) — ele cuida das aspas e da codificação. */
export function toMailFrom(stored: string): { name: string; address: string } | string {
  const parsed = parseSender(stored);
  if (!parsed) return stored;
  return { name: parsed.name ?? DEFAULT_SENDER_NAME, address: parsed.email };
}
