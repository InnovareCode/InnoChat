import { getPrisma } from "@/lib/db/prisma";
import type { PanelTheme } from "@/lib/db/types";

/**
 * `Tenant` não está em `TENANT_SCOPED_MODELS` (é o próprio tenant, não tem coluna `tenantId` —
 * ver src/lib/db/tenant-scope.ts) — por isso usa `getPrisma()` direto, não `forTenant()`.
 * Só é seguro porque `tenantId` chega aqui já validado por `requireTenantMember()` na camada
 * de Server Action (o usuário da sessão precisa ter `Membership` nesse tenant).
 */
export async function updateTenantTheme(tenantId: string, theme: PanelTheme) {
  return getPrisma().tenant.update({
    where: { id: tenantId },
    data: { theme },
    select: { id: true, slug: true, theme: true },
  });
}
