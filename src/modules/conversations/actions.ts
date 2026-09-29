"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { getConversation, type ConversationItem } from "./service";

/**
 * Histórico de conversas do WhatsApp de um cliente (leitura). OWNER e STAFF; sem
 * `assertTenantCanWrite` (é leitura, funciona com a conta suspensa). Retenção: 90 dias.
 */
export async function getConversationAction(input: {
  tenantSlug: string;
  contactId: string;
  cursor?: string;
}): Promise<Result<{ items: ConversationItem[]; nextCursor: string | null }>> {
  return runAction(async () => {
    const data = z
      .object({ tenantSlug: z.string().min(1).max(100), contactId: z.string().min(1).max(120), cursor: z.string().max(200).optional() })
      .parse(input);
    const ctx = await requireTenantMember(data.tenantSlug);
    return getConversation(ctx.tenant.id, data.contactId, data.cursor);
  });
}
