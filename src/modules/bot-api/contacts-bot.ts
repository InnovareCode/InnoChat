import { forTenant } from "@/lib/db/tenant-client";
import { DomainError } from "@/lib/errors";
import { notFound } from "./internal-auth";

/**
 * `PATCH /contacts/{contactId}` (docs/arquitetura.md §6.5, §3 `ASK_NAME`): nome livre de 2 a 60
 * caracteres. Id revalidado contra o tenant da instância — 404 se não pertencer a ele.
 */
export async function updateContactName(tenantId: string, contactId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 60) {
    throw new DomainError("INVALID_NAME", "O nome precisa ter entre 2 e 60 caracteres.");
  }

  const db = forTenant(tenantId);
  const existing = await db.contact.findFirst({ where: { id: contactId } });
  if (!existing) notFound("Cliente não encontrado.");

  return db.contact.update({ where: { id: contactId }, data: { name: trimmed } });
}
