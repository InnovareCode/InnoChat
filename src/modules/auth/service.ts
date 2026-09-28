import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

/**
 * Custo do hash: bcrypt com `SALT_ROUNDS = 12` — mais que o mínimo de 10,
 * ainda rápido o suficiente para não travar o login (login é pouco
 * frequente; cadastro/troca de senha idem).
 */
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export type AuthorizedUser = {
  id: string;
  email: string;
  // O model User (prisma/schema.prisma) não tem campo de nome — é global e
  // não tenant-scoped (docs/arquitetura.md §5). O nome de exibição vive por
  // Membership/Tenant quando essa tela existir.
  name: string | null;
};

/**
 * Usado pelo `authorize()` do provider Credentials (`src/lib/auth.ts`).
 * Nunca lança para credencial inválida — devolve `null`, que é o contrato do
 * Auth.js para "não autenticado" (lançar viraria erro 500, não 401).
 *
 * Mensagem de erro deliberadamente genérica (e-mail OU senha errados) para
 * não confirmar a existência de uma conta por e-mail (enumeration).
 */
export async function verifyCredentials(input: {
  email: string;
  password: string;
}): Promise<AuthorizedUser | null> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    return null;
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logger.info("auth.login.failed", { reason: "user_not_found" });
    return null;
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    logger.info("auth.login.failed", { reason: "bad_password", userId: user.id });
    return null;
  }

  return { id: user.id, email: user.email, name: null };
}
