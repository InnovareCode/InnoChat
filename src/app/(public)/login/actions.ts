"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = { error: string | null };

const GENERIC_ERROR = "E-mail ou senha inválidos.";
// Conta criada só pelo Google (sem senha) — `src/lib/auth.ts#GoogleAccountSignin`.
const GOOGLE_ACCOUNT_ERROR = "Esta conta usa login com Google. Entre com o Google, ou use “Esqueci minha senha” para definir uma senha.";

/**
 * Verificado empiricamente (Playwright, não só lendo o código de
 * `next-auth/lib/actions.js`): `signIn("credentials", { redirect: false })`
 * do Auth.js v5-beta.32 LANÇA `CredentialsSignin` (subclasse de `AuthError`)
 * quando `authorize()` devolve `null` (`src/modules/auth/service.ts`) — não
 * devolve uma URL com `?error=`. `next-auth`/`AuthError` reexporta o
 * suficiente para o `instanceof` funcionar aqui; qualquer outro erro
 * propaga (vira a tela de erro do Next, não uma mensagem genérica de
 * "senha errada").
 *
 * O destino pós-login (tenant do usuário ou admin da plataforma) é resolvido
 * em `/pos-login`, depois que o cookie de sessão já foi gravado — evita
 * duplicar a consulta de `Membership` aqui.
 */
export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: GENERIC_ERROR };
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: (err as { code?: string }).code === "google_account" ? GOOGLE_ACCOUNT_ERROR : GENERIC_ERROR };
    }
    throw err;
  }

  redirect("/pos-login");
}
