"use server";

import { z } from "zod";
import { requireSessionUser, requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { DomainError } from "@/lib/errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/http/client-ip";
import { acceptInvite, inviteTeamMember, requestPasswordReset, resetPassword, signUp, verifyEmail } from "./service";

/**
 * Server Actions do cadastro público e fluxos de conta (docs/contratos.md). Rate limit por IP
 * (§7.3 regra 4) fica AQUI, não em `service.ts` — é uma preocupação de "borda HTTP" (de onde
 * vem a requisição), enquanto `service.ts` é regra de negócio pura de I/O.
 */

function assertRateLimit(scope: string, ip: string, limit: number, windowMs: number) {
  const result = checkRateLimit(`${scope}:${ip}`, limit, windowMs);
  if (!result.allowed) {
    throw new DomainError("RATE_LIMITED", "Muitas tentativas. Tente novamente em alguns minutos.", {
      retryAfterMs: result.retryAfterMs,
    });
  }
}

const signUpSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(3).max(60),
  segment: z.string().trim().max(80).optional(),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(200),
  termsVersion: z.string().min(1).max(50),
  acceptedTerms: z.boolean().refine((v) => v === true, { message: "É preciso aceitar os termos." }),
});

const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 5 cadastros/hora por IP

export async function signUpAction(input: unknown): Promise<Result<{ tenantSlug: string }>> {
  return runAction(async () => {
    const ip = await clientIp();
    assertRateLimit("signup", ip, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);

    const data = signUpSchema.parse(input);
    const result = await signUp({
      companyName: data.companyName,
      slug: data.slug,
      segment: data.segment ?? null,
      ownerName: data.ownerName,
      email: data.email,
      password: data.password,
      termsVersion: data.termsVersion,
    });
    return { tenantSlug: result.tenantSlug };
  });
}

const verifyEmailSchema = z.object({ token: z.string().min(1) });

export async function verifyEmailAction(input: unknown): Promise<Result<{ tenantSlug: string | null }>> {
  return runAction(async () => {
    const data = verifyEmailSchema.parse(input);
    return verifyEmail(data.token);
  });
}

const requestPasswordResetSchema = z.object({ email: z.string().trim().email() });
const RESET_REQUEST_LIMIT = 5;
const RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;

export async function requestPasswordResetAction(input: unknown): Promise<Result<{ requested: true }>> {
  return runAction(async () => {
    const ip = await clientIp();
    assertRateLimit("password-reset", ip, RESET_REQUEST_LIMIT, RESET_REQUEST_WINDOW_MS);

    const data = requestPasswordResetSchema.parse(input);
    await requestPasswordReset(data.email);
    return { requested: true };
  });
}

const resetPasswordSchema = z.object({ token: z.string().min(1), password: z.string().min(8).max(200) });

export async function resetPasswordAction(input: unknown): Promise<Result<{ done: true }>> {
  return runAction(async () => {
    const data = resetPasswordSchema.parse(input);
    await resetPassword(data.token, data.password);
    return { done: true };
  });
}

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["OWNER", "STAFF"]),
});

/** Só OWNER convida (§9, tela de equipe — fora do escopo desta fase, mas a Server Action já existe). */
export async function inviteTeamMemberAction(tenantSlug: string, input: unknown): Promise<Result<{ invited: true }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    const data = inviteSchema.parse(input);
    await inviteTeamMember({ tenantId: tenant.id, tenantName: tenant.name, email: data.email, role: data.role });
    return { invited: true };
  });
}

const acceptInviteSchema = z.object({ token: z.string().min(1), password: z.string().min(8).max(200) });

export async function acceptInviteAction(input: unknown): Promise<Result<{ tenantSlug: string | null }>> {
  return runAction(async () => {
    const data = acceptInviteSchema.parse(input);
    return acceptInvite(data.token, data.password);
  });
}

/** Usada pela tela de "reenviar verificação" (se existir) — exige sessão, não token de convite. */
export async function currentUserIdAction(): Promise<Result<{ userId: string }>> {
  return runAction(async () => {
    const user = await requireSessionUser();
    return { userId: user.id };
  });
}
