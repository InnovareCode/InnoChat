import bcrypt from "bcryptjs";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Custo do hash: bcrypt com `SALT_ROUNDS = 12` — mais que o mínimo de 10,
 * ainda rápido o suficiente para não travar o login (login é pouco
 * frequente; cadastro/troca de senha idem).
 */
const SALT_ROUNDS = 12;

/**
 * Rate limit de login (revisão de segurança 2026-09-28, achado ALTA — `authorize()` é rota
 * padrão do Auth.js, fora de qualquer Server Action, então nenhum `checkRateLimit` cobria
 * força bruta de senha). Dois tetos independentes, por escopos diferentes:
 * - por IP: contém varredura ampla (um atacante tentando várias contas).
 * - por e-mail: contém força bruta contra UMA conta, mesmo de IPs residenciais/CGNAT rotativos
 *   (comuns no Brasil), onde o teto por IP sozinho é fácil de contornar.
 * Limites generosos o bastante para não incomodar um usuário real (login errado por engano
 * algumas vezes, várias abas abertas), e nenhum dos dois é revelado ao cliente: excedendo
 * qualquer um dos dois, `verifyCredentials` devolve `null` — o MESMO retorno de "credencial
 * inválida" (docs/contratos.md "Segurança") — nunca um erro/mensagem distinta, para não abrir
 * um canal de enumeration novo (nem de conta, nem de rate limit).
 */
const LOGIN_IP_LIMIT = 20;
const LOGIN_IP_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_EMAIL_LIMIT = 8;
const LOGIN_EMAIL_WINDOW_MS = 15 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export type AuthorizedUser = {
  id: string;
  email: string;
  // `User.name` (nome de exibição, global — não é por empresa).
  name: string | null;
};

/**
 * Usado pelo `authorize()` do provider Credentials (`src/lib/auth.ts`).
 * Nunca lança para credencial inválida — devolve `null`, que é o contrato do
 * Auth.js para "não autenticado" (lançar viraria erro 500, não 401).
 *
 * Única exceção ao "sempre `null`": conta sem senha (só Google) lança `GOOGLE_ONLY_ACCOUNT`.
 *
 * Mensagem de erro deliberadamente genérica (e-mail OU senha errados) para
 * não confirmar a existência de uma conta por e-mail (enumeration).
 */
export async function verifyCredentials(input: {
  email: string;
  password: string;
  /** IP do cliente (`src/lib/http/client-ip.ts`), resolvido em `src/lib/auth.ts#authorize()`. */
  ip: string;
}): Promise<AuthorizedUser | null> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    return null;
  }

  // Checa (e já incrementa) os dois tetos ANTES de tocar o banco/bcrypt — barato, e evita gastar
  // o custo de bcrypt (propositalmente caro, SALT_ROUNDS=12) numa tentativa que já vai ser
  // recusada por rate limit.
  const ipLimit = checkRateLimit(`login:ip:${input.ip}`, LOGIN_IP_LIMIT, LOGIN_IP_WINDOW_MS);
  const emailLimit = checkRateLimit(`login:email:${email}`, LOGIN_EMAIL_LIMIT, LOGIN_EMAIL_WINDOW_MS);
  if (!ipLimit.allowed || !emailLimit.allowed) {
    logger.info("auth.login.rate_limited", { reason: !ipLimit.allowed ? "ip" : "email" });
    return null;
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    logger.info("auth.login.failed", { reason: "user_not_found" });
    return null;
  }

  // Conta criada só pelo Google (sem senha): dizer isso ao usuário (decisão do dono) em vez do
  // "e-mail ou senha inválidos" — e sem gastar bcrypt. Só chega aqui DEPOIS dos dois tetos de rate
  // limit acima, então não vira um oráculo de enumeração barato. `src/lib/auth.ts` converte isto
  // em `CredentialsSignin` com `code = "google_account"`.
  if (!user.passwordHash) {
    logger.info("auth.login.failed", { reason: "google_only_account", userId: user.id });
    throw new DomainError("GOOGLE_ONLY_ACCOUNT", "Esta conta usa login com Google.");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    logger.info("auth.login.failed", { reason: "bad_password", userId: user.id });
    return null;
  }

  return { id: user.id, email: user.email, name: user.name ?? null };
}
