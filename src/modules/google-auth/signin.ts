import { getPrisma } from "@/lib/db/prisma";
import { isUniqueViolation } from "@/lib/db/prisma-errors";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { forgetSessionVersion } from "@/modules/auth/session-version";
import { acceptInviteWithGoogle } from "@/modules/signup/service";
import { signGoogleToken } from "./tokens";

/**
 * Decisão do callback `signIn` do provedor Google — separada do Auth.js para ser testável.
 *
 * Regras (decisões do dono/Vega, ver docs/contratos.md "Login com Google"):
 * 1. Só entra com `email_verified` = true.
 * 2. Acha o usuário pelo `googleSub`; senão pelo e-mail — e nesse caso VINCULA (grava `googleSub`).
 * 3. Contas de admin da plataforma (`isPlatformAdmin`) NUNCA entram pelo Google: admin controla
 *    o painel de todas as empresas, então fica só com e-mail+senha (o Google seria um segundo
 *    caminho para o mesmo poder). Decisão de segurança — reverter só por pedido explícito do dono.
 * 4. Sem usuário nenhum: NÃO cria empresa sozinho; emite o token `google-signup` (10 min) e a tela
 *    `/cadastro/google` pede os dados da empresa.
 * 5. Vínculo por e-mail em conta ainda NÃO verificada descarta a senha dela (defesa contra
 *    "pre-hijacking": alguém cadastra o e-mail da vítima com senha própria e espera a vítima
 *    entrar pelo Google — sem isto, o atacante continuaria com a senha). No mesmo `update`
 *    incrementa `sessionVersion`: a sessão que o atacante já tinha aberto (login por senha não exige
 *    e-mail verificado) deixa de valer — ver `src/modules/auth/session-version.ts`.
 */

export const GOOGLE_SIGNUP_TOKEN_TTL_MS = 10 * 60 * 1000;

export type GoogleProfile = { sub: string; email: string | null | undefined; emailVerified: boolean; name?: string | null };

export type GoogleDenyReason = "INVALID_PROFILE" | "EMAIL_NOT_VERIFIED" | "PLATFORM_ADMIN" | "GOOGLE_ACCOUNT_MISMATCH" | "INVITE_EMAIL_MISMATCH" | "INVITE_INVALID";

export type GoogleSignInOutcome =
  | { kind: "allow"; userId: string }
  | { kind: "deny"; reason: GoogleDenyReason }
  | { kind: "signup"; token: string };

const deny = (reason: GoogleDenyReason): GoogleSignInOutcome => {
  logger.info("google_auth.signin.denied", { reason });
  return { kind: "deny", reason };
};

export async function resolveGoogleSignIn(profile: GoogleProfile, options: { inviteToken?: string | null } = {}): Promise<GoogleSignInOutcome> {
  const email = profile.email?.trim().toLowerCase();
  if (!profile.sub || !email) return deny("INVALID_PROFILE");
  if (profile.emailVerified !== true) return deny("EMAIL_NOT_VERIFIED");

  const prisma = getPrisma();

  // Convite de equipe: o e-mail do Google precisa bater com o do convite.
  if (options.inviteToken) {
    try {
      const accepted = await acceptInviteWithGoogle(options.inviteToken, { sub: profile.sub, email, name: profile.name });
      logger.info("google_auth.signin.invite_accepted", { userId: accepted.userId });
      return { kind: "allow", userId: accepted.userId };
    } catch (error) {
      if (error instanceof DomainError) {
        if (error.code === "INVITE_EMAIL_MISMATCH") return deny("INVITE_EMAIL_MISMATCH");
        if (error.code === "FORBIDDEN") return deny("PLATFORM_ADMIN");
        if (error.code === "GOOGLE_ACCOUNT_MISMATCH") return deny("GOOGLE_ACCOUNT_MISMATCH");
        if (error.code === "TOKEN_INVALID") return deny("INVITE_INVALID");
      }
      throw error;
    }
  }

  const bySub = await prisma.user.findUnique({ where: { googleSub: profile.sub } });
  if (bySub) {
    if (bySub.isPlatformAdmin) return deny("PLATFORM_ADMIN");
    return { kind: "allow", userId: bySub.id };
  }

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.isPlatformAdmin) return deny("PLATFORM_ADMIN");
    // O e-mail já está ligado a OUTRA conta Google (ex.: e-mail antigo reaproveitado): não troca.
    if (byEmail.googleSub && byEmail.googleSub !== profile.sub) return deny("GOOGLE_ACCOUNT_MISMATCH");

    try {
      const linked = await prisma.user.updateMany({
        where: { id: byEmail.id, googleSub: null },
        data: {
          googleSub: profile.sub,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          ...(byEmail.emailVerifiedAt ? {} : { passwordHash: null, sessionVersion: { increment: 1 } }),
          ...(byEmail.name || !profile.name?.trim() ? {} : { name: profile.name.trim().slice(0, 80) }),
        },
      });
      if (linked.count === 0) {
        // Outra requisição vinculou primeiro: relê e decide de novo.
        const again = await prisma.user.findUnique({ where: { id: byEmail.id } });
        if (again?.googleSub !== profile.sub) return deny("GOOGLE_ACCOUNT_MISMATCH");
      }
    } catch (error) {
      if (isUniqueViolation(error)) return deny("GOOGLE_ACCOUNT_MISMATCH");
      throw error;
    }
    if (!byEmail.emailVerifiedAt) forgetSessionVersion(byEmail.id);
    logger.info("google_auth.signin.linked", { userId: byEmail.id });
    return { kind: "allow", userId: byEmail.id };
  }

  const token = signGoogleToken("google-signup", { email, name: (profile.name ?? "").trim().slice(0, 80), sub: profile.sub }, GOOGLE_SIGNUP_TOKEN_TTL_MS);
  logger.info("google_auth.signin.needs_signup", {});
  return { kind: "signup", token };
}
