import nodemailer from "nodemailer";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * E-mail transacional via SMTP próprio (decisão do dono, 2026-09-28) — credenciais em
 * `PlatformSettings.smtp*`, nunca em env var (docs/arquitetura.md §14). `nodemailer` cria um
 * transporte novo por envio: o volume é baixo (transacional, não campanha) e evita manter um
 * pool vivo com credenciais que podem trocar a qualquer momento no admin da plataforma.
 */

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * Erro de DOMÍNIO (nunca crash) quando o SMTP não está configurado — quem chama decide o que
 * fazer (bloquear o fluxo ou só logar e seguir, conforme o e-mail for essencial ou não).
 */
export class SmtpNotConfiguredError extends DomainError {
  constructor() {
    super("SMTP_NOT_CONFIGURED", "SMTP não configurado em PlatformSettings — configure em Admin > Configurações.");
  }
}

async function loadSmtpConfig() {
  const settings = await getPrisma().platformSettings.findUnique({
    where: { id: 1 },
    select: { smtpHost: true, smtpPort: true, smtpSecure: true, smtpUser: true, smtpPassword: true, smtpFrom: true },
  });

  if (!settings?.smtpHost || !settings.smtpPort || !settings.smtpFrom) {
    throw new SmtpNotConfiguredError();
  }

  return settings;
}

/**
 * Envia um e-mail. Nunca lança para "SMTP indisponível/erro de rede" — loga (sem segredo, sem
 * corpo do e-mail — só destino e assunto, docs/arquitetura.md §11 "nunca logar... dado
 * pessoal") e devolve `{ sent: false }`; quem chama decide se isso bloqueia o fluxo (ex.:
 * cadastro segue mesmo se o e-mail de verificação falhar ao enviar — a conta existe, o usuário
 * pode pedir reenvio depois) ou não. Só lança `SmtpNotConfiguredError` (erro de domínio, não de
 * infraestrutura) quando falta configuração — isso É um erro de configuração que vale a pena
 * propagar como 4xx/DomainError em vez de engolir.
 */
export async function sendMail(input: SendMailInput): Promise<{ sent: boolean }> {
  const config = await loadSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: config.smtpHost!,
    port: config.smtpPort!,
    secure: !!config.smtpSecure,
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword ?? undefined } : undefined,
  });

  try {
    await transporter.sendMail({
      from: config.smtpFrom!,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { sent: true };
  } catch (error) {
    // Nunca loga `input.to` (e-mail é dado pessoal, docs/arquitetura.md §11) — só o assunto
    // (identifica o TIPO de e-mail, não o destinatário) e a mensagem de erro do transporte.
    logger.error("email.send.failed", {
      subject: input.subject,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { sent: false };
  }
}
