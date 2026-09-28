import { PrismaClient } from "@prisma/client";

declare global {
  var __innochatPrisma__: PrismaClient | undefined;
}

/**
 * Cliente cru do Prisma Client, exposto como FUNÇÃO (`getPrisma()`), nunca
 * como Proxy.
 *
 * Lição do InnoAtendente: um `PrismaClient` embrulhado em `new Proxy(...)`
 * (para, por exemplo, interceptar acesso lazy) quebra clients stateful — o
 * Prisma Client mantém conexão e estado interno por instância, e um Proxy
 * que redireciona `get`/`apply` para recriar ou revalidar o alvo a cada
 * acesso perde essa identidade (transações, `$extends`, pool de conexão).
 * Por isso: singleton de verdade, guardado em `globalThis` (sobrevive ao
 * hot-reload do `next dev`, que senão recriaria um `PrismaClient` novo a
 * cada reload e esgotaria conexões), devolvido por uma função simples.
 *
 * USO RESTRITO: só pode ser importado dentro de `src/lib/db/` (regra de
 * ESLint em `eslint.config.mjs`). Fora daqui:
 * - Model tenant-scoped (Membership, Contact, Appointment, ... — ver
 *   docs/arquitetura.md §5) → `forTenant(tenantId)` de `./tenant-client`.
 * - Model não tenant-scoped (User, PlatformSettings, Plan, ProviderEvent,
 *   TrialClaim, AuthToken) → `getPrisma()` direto, só em código que já
 *   validou o escopo certo (ex.: rotas que checam `isPlatformAdmin`).
 */
export function getPrisma(): PrismaClient {
  if (!globalThis.__innochatPrisma__) {
    globalThis.__innochatPrisma__ = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalThis.__innochatPrisma__;
}
