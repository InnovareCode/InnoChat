import crypto from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/modules/auth/service";
import { sendMail, loadEmailContext, verificationEmail, passwordResetEmail, teamInviteEmail } from "@/lib/email";
import { getPublicBaseUrl } from "@/lib/public-url";
import type { MembershipRole } from "@/lib/db/types";
import { validateSlug, type SlugValidationError } from "@/core/signup/slug";
import { validateCpfCnpj } from "@/core/billing";
import {
  billingUrlFor,
  findBillingRecipientEmail,
  generateInvoiceDescription,
  getDefaultSignupPlan,
  newTrialEndsAt,
  sendInvoiceGeneratedEmail,
  tryAttachPix,
} from "@/modules/billing/service";
import type { MercadoPagoGateway } from "@/modules/billing/mercadopago";

/**
 * Cadastro público + conta (docs/arquitetura.md §7.3, docs/contratos.md). Separado de
 * `src/modules/auth/service.ts` (login) e de `src/modules/billing/service.ts` (fatura/Pix) —
 * este módulo é quem ORQUESTRA os dois na hora do cadastro.
 */

// ---------------------------------------------------------------------------
// Tokens de uso único (verificação de e-mail, redefinição de senha, convite)
// ---------------------------------------------------------------------------

const TOKEN_BYTES = 32;
const VERIFY_EMAIL_TTL_MS = 48 * 60 * 60 * 1000; // 48h — sem regra explícita do dono; folgado o bastante para não frustrar quem não abre o e-mail no mesmo dia.
const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000; // 1h (§7.3 regra 5)
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias (§7.3 regra 6)

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function createAuthToken(userId: string, type: "VERIFY_EMAIL" | "RESET_PASSWORD" | "INVITE", ttlMs: number) {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMs);
  await getPrisma().authToken.create({
    data: { userId, type, tokenHash: hashToken(rawToken), expiresAt },
  });
  return { rawToken, expiresAt };
}

/**
 * Consome um token de uso único: valida tipo + validade + `usedAt` nulo, marca como usado numa
 * `update` condicional (`usedAt: null` no `where`) para que duas requisições simultâneas com o
 * MESMO token nunca consumam as duas — a segunda sempre perde a corrida e recebe
 * `TOKEN_INVALID`, nunca aplica o efeito duas vezes.
 */
async function consumeAuthToken(rawToken: string, type: "VERIFY_EMAIL" | "RESET_PASSWORD" | "INVITE"): Promise<{ userId: string }> {
  const tokenHash = hashToken(rawToken);
  const prisma = getPrisma();

  const token = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) {
    throw new DomainError("TOKEN_INVALID", "Link inválido ou expirado.");
  }

  const result = await prisma.authToken.updateMany({
    where: { id: token.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (result.count === 0) {
    // Perdeu a corrida para outra requisição com o mesmo token — mesma resposta de "inválido".
    throw new DomainError("TOKEN_INVALID", "Link inválido ou expirado.");
  }

  return { userId: token.userId };
}

// ---------------------------------------------------------------------------
// Cadastro público
// ---------------------------------------------------------------------------

export type SignUpInput = {
  companyName: string;
  slug: string;
  segment: string | null;
  ownerName: string;
  email: string;
  password: string;
  termsVersion: string;
  // CPF/CNPJ da empresa (docs/contratos.md, "Cadastro público" — OBRIGATÓRIO desde
  // 2026-09-29: a primeira fatura já nasce no cadastro e o Mercado Pago exige
  // `payer.identification` para gerar o Pix dela; sem o documento, aquele Pix nunca saía de
  // verdade — ver `tryAttachPix`). Aceita formatado ou só dígitos (`validateCpfCnpj` normaliza).
  document: string;
};

export type SignUpResult = {
  tenantSlug: string;
  userId: string;
};

function slugErrorMessage(error: SlugValidationError): string {
  switch (error) {
    case "TOO_SHORT":
      return "O endereço da empresa precisa ter pelo menos 3 caracteres.";
    case "TOO_LONG":
      return "O endereço da empresa é muito longo.";
    case "INVALID_FORMAT":
      return "O endereço da empresa só pode ter letras minúsculas, números e hífen (sem espaços ou acentos).";
    case "RESERVED":
      return "Este endereço é reservado pelo sistema — escolha outro.";
  }
}

/**
 * Cria `User(OWNER)` + `Tenant` + `Membership` + `Subscription(TRIALING, +3 dias — `TRIAL_DAYS`)` + a primeira
 * fatura (§7.3 regra 1) numa única transação — se qualquer passo falhar (ex.: e-mail duplicado
 * detectado por uma corrida), nada fica pela metade. O Pix da primeira fatura e os e-mails
 * (verificação + fatura gerada) são efeitos colaterais DEPOIS da transação confirmar: chamada de
 * rede (Mercado Pago/SMTP) dentro de uma transação de banco arrisca prender a conexão em i/o
 * externo — e se falhar, não deve desfazer o cadastro (a conta existe, o Pix pode ser gerado
 * depois na tela de Assinatura).
 */
export async function signUp(input: SignUpInput, gateway?: MercadoPagoGateway): Promise<SignUpResult> {
  const email = input.email.trim().toLowerCase();
  const slug = input.slug.trim().toLowerCase();

  const slugError = validateSlug(slug);
  if (slugError) {
    throw new DomainError("INVALID_SLUG", slugErrorMessage(slugError), { rule: slugError });
  }

  const validatedDocument = validateCpfCnpj(input.document);
  if (!validatedDocument.valid) {
    throw new DomainError("INVALID_DOCUMENT", "CPF ou CNPJ inválido — confira os dígitos.");
  }

  const prisma = getPrisma();
  const now = new Date();
  const trialEndsAt = newTrialEndsAt(now);
  const plan = await getDefaultSignupPlan();

  const passwordHash = await hashPassword(input.password);

  const created = await prisma.$transaction(async (tx) => {
    const existingEmail = await tx.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new DomainError("EMAIL_TAKEN", "Este e-mail já está em uso.");
    }
    const existingSlug = await tx.tenant.findUnique({ where: { slug } });
    if (existingSlug) {
      throw new DomainError("SLUG_TAKEN", "Este endereço de empresa já está em uso.");
    }

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: input.ownerName.trim(),
        termsAcceptedAt: now,
        termsVersion: input.termsVersion,
      },
    });

    const tenant = await tx.tenant.create({
      data: {
        slug,
        name: input.companyName.trim(),
        segment: input.segment?.trim() || null,
        document: validatedDocument.digits,
        timezone: "America/Sao_Paulo", // único fuso suportado na v1 (docs/arquitetura.md §14)
      },
    });

    await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "OWNER" } });

    const subscription = await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: plan.id,
        status: "TRIALING",
        trialEndsAt,
        currentPeriodEnd: trialEndsAt, // o trial É o primeiro período (§7.3)
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amountCents: plan.priceCents,
        periodStart: now,
        periodEnd: trialEndsAt,
        dueAt: trialEndsAt,
        status: "OPEN",
        isTrialConversion: true, // fatura do teste: fora de "a receber"/"vencido" no Admin → Cobrança
      },
    });

    return { user, tenant, invoice };
  });

  // Fora da transação: rede externa (MP + SMTP), nunca desfaz o cadastro se falhar. A fatura JÁ
  // existe (criada dentro da transação acima) — usamos `tryAttachPix` direto, não
  // `createInvoiceForPeriod`/`createInvoiceForPeriodTracked` (que trataria esta fatura recém-
  // criada como "já existe" pelo check de idempotência e nunca chamaria o Mercado Pago).
  const invoiceWithPix = await tryAttachPix(created.invoice.id, email, generateInvoiceDescription(created.tenant.name), gateway);

  await sendInvoiceGeneratedEmail({
    toEmail: email,
    tenantName: created.tenant.name,
    tenantSlug: created.tenant.slug,
    amountCents: created.invoice.amountCents,
    dueAt: created.invoice.dueAt,
    pixCopyPaste: invoiceWithPix?.pixCopyPaste ?? null,
    timezone: created.tenant.timezone,
  });

  await sendVerificationEmail(created.user.id, email);

  logger.info("signup.completed", { tenantId: created.tenant.id });

  return { tenantSlug: created.tenant.slug, userId: created.user.id };
}

/** Gera um token novo de verificação e envia o e-mail. Falha de SMTP só loga: nunca desfaz o fluxo. */
async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const { rawToken } = await createAuthToken(userId, "VERIFY_EMAIL", VERIFY_EMAIL_TTL_MS);
  const verifyUrl = `${await getPublicBaseUrl()}/verificar-email?token=${rawToken}`;
  const { subject, html, text } = verificationEmail({ verifyUrl, ctx: await loadEmailContext() });
  await sendMail({ to: email, subject, html, text }).catch((error) => {
    logger.error("signup.verification_email.failed", { errorMessage: error instanceof Error ? error.message : String(error) });
  });
}

/**
 * Reenvio pedido pelo próprio usuário logado (tela WhatsApp/onboarding, quando falta confirmar o
 * e-mail). Já verificado → não envia nada e informa, para a tela parar de oferecer o botão.
 */
export async function resendVerificationEmail(userId: string): Promise<{ alreadyVerified: boolean }> {
  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
  if (!user) throw new DomainError("NOT_FOUND", "Usuário não encontrado.");
  if (user.emailVerifiedAt) return { alreadyVerified: true };
  await sendVerificationEmail(userId, user.email);
  return { alreadyVerified: false };
}

export async function verifyEmail(rawToken: string): Promise<{ tenantSlug: string | null }> {
  const { userId } = await consumeAuthToken(rawToken, "VERIFY_EMAIL");
  await getPrisma().user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });

  const membership = await getPrisma().membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { tenant: { select: { slug: true } } },
  });
  return { tenantSlug: membership?.tenant.slug ?? null };
}

// ---------------------------------------------------------------------------
// Esqueci a senha
// ---------------------------------------------------------------------------

/**
 * Nunca revela se o e-mail existe (mesma lógica de `verifyCredentials` — sem enumeration): se
 * não encontrar o usuário, só não envia nada e devolve normalmente.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const user = await getPrisma().user.findUnique({ where: { email: normalized } });
  if (!user) {
    logger.info("password_reset.requested_unknown_email");
    return;
  }

  const { rawToken } = await createAuthToken(user.id, "RESET_PASSWORD", RESET_PASSWORD_TTL_MS);
  const resetUrl = `${await getPublicBaseUrl()}/redefinir-senha?token=${rawToken}`;
  const { subject, html, text } = passwordResetEmail({ resetUrl, ctx: await loadEmailContext() });
  await sendMail({ to: normalized, subject, html, text }).catch((error) => {
    logger.error("password_reset.email.failed", { errorMessage: error instanceof Error ? error.message : String(error) });
  });
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const { userId } = await consumeAuthToken(rawToken, "RESET_PASSWORD");
  const passwordHash = await hashPassword(newPassword);
  await getPrisma().user.update({ where: { id: userId }, data: { passwordHash } });
}

// ---------------------------------------------------------------------------
// Convite de equipe (§7.3 regra 6)
// ---------------------------------------------------------------------------

export async function inviteTeamMember(params: { tenantId: string; tenantName: string; email: string; role: MembershipRole }): Promise<void> {
  const email = params.email.trim().toLowerCase();
  const prisma = getPrisma();

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // Senha aleatória e inutilizável até o convite ser aceito (`acceptInvite` a troca) — a
    // conta "existe" (tem id, pode receber Membership) mas ninguém consegue entrar com ela
    // antes de definir a própria senha.
    const placeholderPasswordHash = await hashPassword(crypto.randomBytes(24).toString("base64url"));
    user = await prisma.user.create({ data: { email, passwordHash: placeholderPasswordHash } });
  }

  const existingMembership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId: params.tenantId } },
  });
  if (existingMembership) {
    throw new DomainError("ALREADY_MEMBER", "Este e-mail já faz parte da equipe.");
  }

  await prisma.membership.create({ data: { userId: user.id, tenantId: params.tenantId, role: params.role } });

  const { rawToken } = await createAuthToken(user.id, "INVITE", INVITE_TTL_MS);
  const inviteUrl = `${await getPublicBaseUrl()}/convite?token=${rawToken}`;
  const { subject, html, text } = teamInviteEmail({ tenantName: params.tenantName, inviteUrl, ctx: await loadEmailContext() });
  await sendMail({ to: email, subject, html, text }).catch((error) => {
    logger.error("invite.email.failed", { errorMessage: error instanceof Error ? error.message : String(error) });
  });
}

export async function acceptInvite(rawToken: string, password: string, name: string): Promise<{ tenantSlug: string | null }> {
  const { userId } = await consumeAuthToken(rawToken, "INVITE");
  const passwordHash = await hashPassword(password);
  await getPrisma().user.update({ where: { id: userId }, data: { passwordHash, name: name.trim(), emailVerifiedAt: new Date() } });

  const membership = await getPrisma().membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { tenant: { select: { slug: true } } },
  });
  return { tenantSlug: membership?.tenant.slug ?? null };
}

export { billingUrlFor, findBillingRecipientEmail };
