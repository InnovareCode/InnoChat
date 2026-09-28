import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db/prisma";
import { forTenant } from "@/lib/db/tenant-client";
import { DomainError } from "@/lib/errors";
import type { MembershipRole } from "@/lib/db/types";

export type SessionUser = { id: string };

export type TenantContext = {
  tenant: { id: string; slug: string; name: string; timezone: string };
  membership: { id: string; role: MembershipRole };
  user: SessionUser;
};

/**
 * Exige uma sessão válida (Auth.js). Lança `UNAUTHENTICATED` — as Server Actions convertem
 * isso em `Result` de erro (src/lib/result.ts); páginas/layouts que exigem login tratam via
 * `redirect()` antes de chegar aqui (fora do escopo da Vega, ver src/app/**).
 */
export async function requireSessionUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new DomainError("UNAUTHENTICATED", "É necessário estar autenticado.");
  }
  return { id: session.user.id };
}

/**
 * Guarda do admin da plataforma (docs/arquitetura.md §9, "Plataforma"). Nunca confia em nada
 * vindo do client — sempre relê `isPlatformAdmin` do banco a partir do id da sessão.
 */
export async function requirePlatformAdmin(): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  const user = await getPrisma().user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, isPlatformAdmin: true },
  });
  if (!user?.isPlatformAdmin) {
    throw new DomainError("FORBIDDEN", "Requer acesso de administrador da plataforma.");
  }
  return { id: user.id };
}

/**
 * Guarda de tenant (docs/arquitetura.md §5, §11): resolve o tenant pelo `slug` — nunca por um
 * id vindo do client — e confirma que o usuário da sessão tem `Membership` nele. Se `roles` for
 * passado, também exige que o papel do usuário esteja na lista.
 *
 * Empresa inexistente OU usuário sem membership → o mesmo `NOT_FOUND` (nunca `FORBIDDEN`), pela
 * mesma razão do §6.1 da API interna: não confirmar a existência de uma empresa para quem não é
 * membro dela.
 */
export async function requireTenantMember(slug: string, roles?: MembershipRole[]): Promise<TenantContext> {
  const sessionUser = await requireSessionUser();

  const tenant = await getPrisma().tenant.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true, timezone: true },
  });
  if (!tenant) {
    throw new DomainError("NOT_FOUND", "Empresa não encontrada.");
  }

  const membership = await forTenant(tenant.id).membership.findFirst({
    where: { userId: sessionUser.id },
  });
  if (!membership) {
    throw new DomainError("NOT_FOUND", "Empresa não encontrada.");
  }

  if (roles && roles.length > 0 && !roles.includes(membership.role)) {
    throw new DomainError("FORBIDDEN", "Sem permissão para esta ação.");
  }

  return {
    tenant,
    membership: { id: membership.id, role: membership.role },
    user: sessionUser,
  };
}
