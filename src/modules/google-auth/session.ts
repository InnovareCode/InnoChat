import { getPrisma } from "@/lib/db/prisma";

/** Helpers de sessão do login com Google (usados por `src/lib/auth.ts`, que não toca Prisma). */

/** Id do NOSSO usuário a partir do `sub` do Google já vinculado. Admin da plataforma nunca. */
export async function userIdForGoogleSub(sub: string): Promise<string | null> {
  if (!sub) return null;
  const user = await getPrisma().user.findUnique({ where: { googleSub: sub }, select: { id: true, isPlatformAdmin: true } });
  if (!user || user.isPlatformAdmin) return null;
  return user.id;
}

/** Usuário para abrir sessão depois do cadastro pelo Google (admin da plataforma nunca). */
export async function loadGoogleLoginUser(userId: string): Promise<{ id: string; email: string; name: string | null } | null> {
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user || user.isPlatformAdmin) return null;
  return { id: user.id, email: user.email, name: user.name ?? null };
}
