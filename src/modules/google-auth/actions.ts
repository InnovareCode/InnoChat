"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { runAction, type Result } from "@/lib/result";
import { DomainError } from "@/lib/errors";
import { getPrisma } from "@/lib/db/prisma";
import { createHash } from "node:crypto";
import { signIn } from "@/lib/auth";
import { GOOGLE_INVITE_COOKIE, GOOGLE_INVITE_COOKIE_MAX_AGE_S } from "./invite-cookie";

/** Server Action do convite de equipe com Google. As do ADMIN ficam em `src/modules/platform/actions.ts`. */

/**
 * Convite de equipe COM Google. A tela `/convite?token=...` chama isto no clique de "Entrar com
 * Google": valida o convite (sem consumir), guarda o token num cookie httpOnly de 15 min e segue
 * para o Google. No callback `signIn` o cookie é lido e `acceptInviteWithGoogle` exige que o
 * e-mail do Google seja o do convite. O token nunca passa pelo Google nem pela URL de volta.
 */
export async function startGoogleInviteSignInAction(input: unknown): Promise<Result<never>> {
  const parsed = z.object({ token: z.string().min(10).max(200) }).safeParse(input);
  const result = await runAction(async () => {
    if (!parsed.success) throw new DomainError("TOKEN_INVALID", "Convite inválido ou expirado.");
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const token = await getPrisma().authToken.findUnique({ where: { tokenHash }, select: { type: true, usedAt: true, expiresAt: true } });
    if (!token || token.type !== "INVITE" || token.usedAt || token.expiresAt < new Date()) {
      throw new DomainError("TOKEN_INVALID", "Convite inválido ou expirado.");
    }
    (await cookies()).set(GOOGLE_INVITE_COOKIE, parsed.data.token, {
      httpOnly: true,
      sameSite: "lax", // o retorno do Google é uma navegação top-level GET: `lax` envia o cookie
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GOOGLE_INVITE_COOKIE_MAX_AGE_S,
    });
    return null as never;
  });
  if (!result.ok) return result;
  // `signIn` lança o redirect para o Google (NEXT_REDIRECT) — não capturar.
  await signIn("google", { redirectTo: "/pos-login" });
  return result;
}
