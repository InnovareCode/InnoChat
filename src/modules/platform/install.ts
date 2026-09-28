import crypto from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword } from "@/modules/auth/service";

/**
 * Instalação única do primeiro admin da plataforma (docs/contratos.md — "Configuração pela
 * plataforma"). Não há seed de admin em produção nem env var: o operador recebe um código de
 * uso único impresso no log do container e usa `/instalacao` (pública, mas só responde
 * enquanto não existir nenhum `User.isPlatformAdmin`).
 */

const INSTALL_CODE_BYTES = 24;
const INSTALL_CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function hashInstallCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function hasPlatformAdmin(): Promise<boolean> {
  const admin = await getPrisma().user.findFirst({ where: { isPlatformAdmin: true }, select: { id: true } });
  return !!admin;
}

/**
 * Chamada no boot do servidor (`src/instrumentation.ts`). Enquanto não houver admin, gera um
 * código NOVO a cada boot (substitui o anterior — nunca acumula mais de um vigente) e imprime
 * em texto puro UMA ÚNICA VEZ, direto no `console.log` (não pelo `logger` estruturado — este é
 * o único lugar do sistema onde este valor aparece, de propósito, e não deve ir para nenhum
 * pipeline de log que redija por engano). Regenerar a cada boot é deliberado: se o operador
 * perder a linha do log (container reiniciado, log truncado), reiniciar de novo entrega um
 * código válido — não há "segundo código" flutuando por aí para alguém reaproveitar depois.
 *
 * Não faz nada (nem loga) se já existir um admin — boot normal, em produção, todo dia.
 */
export async function bootstrapInstallCodeIfNeeded(): Promise<void> {
  const prisma = getPrisma();
  if (await hasPlatformAdmin()) return;

  const code = crypto.randomBytes(INSTALL_CODE_BYTES).toString("base64url");
  const codeHash = hashInstallCode(code);
  const expiresAt = new Date(Date.now() + INSTALL_CODE_TTL_MS);

  await prisma.$transaction([
    prisma.platformInstallCode.deleteMany({}),
    prisma.platformInstallCode.create({ data: { codeHash, expiresAt } }),
  ]);

  console.log(`InnoChat: código de instalação = ${code} (válido por 24h, use em /instalacao)`);
}

export type InstallPlatformAdminInput = {
  code: string;
  name: string;
  email: string;
  password: string;
};

/**
 * Cria o primeiro admin da plataforma. Reconfere "ainda não há admin" e consome o código
 * DENTRO da transação (mesmo padrão de `consumeAuthToken` em `src/modules/signup/service.ts`):
 * duas instalações concorrentes com o mesmo código nunca criam dois admins — a segunda perde a
 * corrida e recebe `INSTALL_CODE_INVALID`.
 */
export async function installPlatformAdmin(input: InstallPlatformAdminInput): Promise<{ userId: string }> {
  const email = input.email.trim().toLowerCase();
  const codeHash = hashInstallCode(input.code.trim());
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const prisma = getPrisma();

  const user = await prisma.$transaction(async (tx) => {
    const existingAdmin = await tx.user.findFirst({ where: { isPlatformAdmin: true }, select: { id: true } });
    if (existingAdmin) {
      throw new DomainError("ALREADY_INSTALLED", "A instalação já foi concluída.");
    }

    const consumed = await tx.platformInstallCode.updateMany({
      where: { codeHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (consumed.count === 0) {
      throw new DomainError("INSTALL_CODE_INVALID", "Código de instalação inválido ou expirado.");
    }

    const existingEmail = await tx.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new DomainError("EMAIL_TAKEN", "Este e-mail já está em uso.");
    }

    return tx.user.create({
      data: {
        email,
        passwordHash,
        isPlatformAdmin: true,
        emailVerifiedAt: now,
      },
    });
  });

  logger.info("platform.install.completed", { userId: user.id });
  return { userId: user.id };
}
