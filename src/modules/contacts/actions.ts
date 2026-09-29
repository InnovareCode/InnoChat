"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { assertTenantCanWrite } from "@/modules/billing/service";
import {
  createContact,
  deleteContact,
  exportContactsCsv,
  getContact,
  listContacts,
  setContactBotPaused,
  updateContact,
  type ContactDetail,
  type ContactListItem,
} from "./contacts";

const listSchema = z.object({
  q: z.string().trim().max(120).optional(),
  filter: z.enum(["all", "upcoming", "botPaused", "inactive90d"]).optional(),
  cursor: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function listContactsAction(
  tenantSlug: string,
  input?: unknown,
): Promise<Result<{ items: ContactListItem[]; nextCursor: string | null }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = listSchema.parse(input ?? {});
    return listContacts(tenant.id, data);
  });
}

export async function getContactAction(tenantSlug: string, contactId: string): Promise<Result<ContactDetail>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    return getContact(tenant.id, contactId);
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(30),
  notes: z.string().trim().max(2000).optional(),
});

export async function createContactAction(tenantSlug: string, input: unknown): Promise<Result<{ id: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    await assertTenantCanWrite(tenant.id);
    const data = createSchema.parse(input);
    return createContact(tenant.id, data);
  });
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function updateContactAction(tenantSlug: string, contactId: string, input: unknown): Promise<Result<{ id: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    await assertTenantCanWrite(tenant.id);
    const data = updateSchema.parse(input);
    return updateContact(tenant.id, contactId, data);
  });
}

const MAX_PAUSE_HOURS = 24 * 365; // 1 ano — teto de sanidade, "indefinido" (sem `hours`) não passa por aqui.

const setBotPausedSchema = z.object({
  paused: z.boolean(),
  hours: z.coerce.number().int().min(1).max(MAX_PAUSE_HOURS).optional(),
});

export async function setContactBotPausedAction(
  tenantSlug: string,
  contactId: string,
  input: unknown,
): Promise<Result<{ botPausedUntil: string | null }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    await assertTenantCanWrite(tenant.id);
    const data = setBotPausedSchema.parse(input);
    return setContactBotPaused(tenant.id, contactId, data);
  });
}

/** Só OWNER (exclusão/anonimização é irreversível) — mesmo padrão de `billing/actions.ts`. */
export async function deleteContactAction(tenantSlug: string, contactId: string): Promise<Result<{ mode: "deleted" | "anonymized" }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    await assertTenantCanWrite(tenant.id);
    return deleteContact(tenant.id, contactId);
  });
}

/** Só OWNER — exportação em massa dos dados pessoais de todos os clientes. */
export async function exportContactsCsvAction(tenantSlug: string): Promise<Result<{ filename: string; csv: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug, ["OWNER"]);
    return exportContactsCsv(tenant.id);
  });
}
