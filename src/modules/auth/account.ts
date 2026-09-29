import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";

export type MyAccount = { name: string | null; email: string };

export async function getAccount(userId: string): Promise<MyAccount> {
  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  if (!user) throw new DomainError("NOT_FOUND", "Usuário não encontrado.");
  return { name: user.name, email: user.email };
}

/** Altera SÓ o usuário informado (o id vem da sessão, nunca do client). */
export async function updateAccountName(userId: string, name: string): Promise<MyAccount> {
  const user = await getPrisma().user.update({ where: { id: userId }, data: { name }, select: { name: true, email: true } });
  return { name: user.name, email: user.email };
}
