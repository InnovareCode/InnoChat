import { getPrisma } from "./prisma";
import { isTenantScopedModel, scopeArgsToTenant } from "./tenant-scope";

export { TENANT_SCOPED_MODELS, isTenantScopedModel } from "./tenant-scope";

/**
 * Client Prisma escopado por tenant — a defesa principal do isolamento
 * multi-tenant (docs/arquitetura.md §5, §11). Injeta `tenantId` em toda
 * leitura/escrita dos models tenant-scoped; não tenant-scoped passam direto.
 *
 * `tenantId` só pode vir da sessão (painel) ou da instância resolvida pelo
 * `webhookToken` (API interna) — nunca do corpo da requisição.
 *
 * Nunca importe `@prisma/client` fora de `src/lib/db/` (regra de ESLint em
 * `eslint.config.mjs`) — sempre passe por aqui ou por `getPrisma()`.
 */
export function forTenant(tenantId: string) {
  if (!tenantId) {
    throw new Error("forTenant() chamado sem tenantId — isso nunca pode acontecer.");
  }

  return getPrisma().$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantScopedModel(model)) {
            return query(args);
          }
          return query(scopeArgsToTenant({ model, operation, args, tenantId }));
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof forTenant>;
