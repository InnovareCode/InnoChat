"use server";

import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";
import { GOOGLE_INVITE_COOKIE } from "@/modules/google-auth/invite-cookie";

/**
 * Inicia o login/cadastro com Google. `signIn` lança o redirect (NEXT_REDIRECT) para o Google —
 * por isso não há `try/catch` aqui: o Next precisa deixar o redirect propagar. Quem decide o que
 * acontece na volta (entrar, vincular ou mandar para `/cadastro/google`) é o backend.
 */
export async function signInWithGoogleAction(): Promise<void> {
  // Login normal: um cookie de convite esquecido (aba de convite abandonada) NÃO pode ser
  // aplicado a este login — descarta antes de ir ao Google (revisão do Órion S2).
  (await cookies()).delete(GOOGLE_INVITE_COOKIE);
  await signIn("google", { redirectTo: "/pos-login" });
}
