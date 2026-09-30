import { isGoogleAuthAvailable } from "@/modules/google-auth/config";

export type PublicAuthOptions = { google: boolean };

/**
 * O que as telas públicas (login/cadastro/convite) podem oferecer. Sem login, sem segredo: só um
 * booleano. `google` = ligado no admin com Client ID e secret que decifram. Nunca lança — se o
 * banco falhar, mostra só e-mail+senha.
 */
export async function getPublicAuthOptions(): Promise<PublicAuthOptions> {
  try {
    return { google: await isGoogleAuthAvailable() };
  } catch {
    return { google: false };
  }
}
