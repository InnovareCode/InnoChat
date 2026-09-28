"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { BOT_TEXT_KEYS } from "@/core/bot/texts";
import { listBotTexts, previewBotText, resetBotText, upsertBotText } from "./service";

/**
 * CRUD de `BotText` para a futura tela "Mensagens do bot" (Lyra, fora do escopo da Fase 4 —
 * "sem tela" nesta fase). Guardadas por `requireTenantMember(tenantSlug)`, mesma convenção de
 * `docs/contratos.md`.
 */

const keySchema = z.enum(BOT_TEXT_KEYS);

export async function listBotTextsAction(tenantSlug: string): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    return listBotTexts(tenant.id);
  });
}

const upsertSchema = z.object({ key: keySchema, text: z.string().trim().min(1).max(1000) });

export async function upsertBotTextAction(tenantSlug: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = upsertSchema.parse(input);
    return upsertBotText(tenant.id, data.key, data.text);
  });
}

export async function resetBotTextAction(tenantSlug: string, key: unknown): Promise<Result<{ key: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const parsedKey = keySchema.parse(key);
    await resetBotText(tenant.id, parsedKey);
    return { key: parsedKey };
  });
}

const previewSchema = z.object({ text: z.string().trim().min(1).max(1000) });

/** Pré-visualização com valores de exemplo — não exige o texto já estar salvo. */
export async function previewBotTextAction(tenantSlug: string, input: unknown): Promise<Result<{ preview: string; unknownVariables: string[] }>> {
  return runAction(async () => {
    await requireTenantMember(tenantSlug);
    const data = previewSchema.parse(input);
    return previewBotText(data.text);
  });
}
