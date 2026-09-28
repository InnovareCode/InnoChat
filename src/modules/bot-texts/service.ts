import { forTenant } from "@/lib/db/tenant-client";
import { DomainError } from "@/lib/errors";
import type { BotTextKey } from "@/lib/db/types";
import { BOT_TEXT_KEYS, DEFAULT_BOT_TEXTS, findUnknownVariables, renderTemplate, type BotTextKeyLiteral } from "@/core/bot/texts";

export { BOT_TEXT_KEYS, BOT_TEXT_VARIABLES } from "@/core/bot/texts";

/**
 * Mescla os padrões (`DEFAULT_BOT_TEXTS`, pt-BR) com as edições do tenant (`BotText`,
 * docs/arquitetura.md §6.7) — usado pelo `claim` (§6.2, campo `texts`) e pela futura tela
 * "Mensagens do bot" (Lyra). Uma chave sem linha em `BotText` vale o padrão do código.
 */
export async function getMergedBotTexts(tenantId: string): Promise<Record<BotTextKeyLiteral, string>> {
  const overrides = await forTenant(tenantId).botText.findMany();
  const overrideByKey = new Map(overrides.map((o) => [o.key as BotTextKeyLiteral, o.text]));

  const merged = {} as Record<BotTextKeyLiteral, string>;
  for (const key of BOT_TEXT_KEYS) {
    merged[key] = overrideByKey.get(key) ?? DEFAULT_BOT_TEXTS[key];
  }
  return merged;
}

export async function listBotTexts(tenantId: string): Promise<{ key: BotTextKeyLiteral; text: string; isDefault: boolean }[]> {
  const overrides = await forTenant(tenantId).botText.findMany();
  const overrideByKey = new Map(overrides.map((o) => [o.key as BotTextKeyLiteral, o.text]));

  return BOT_TEXT_KEYS.map((key) => {
    const override = overrideByKey.get(key);
    return { key, text: override ?? DEFAULT_BOT_TEXTS[key], isDefault: override === undefined };
  });
}

function assertKnownVariables(text: string) {
  const unknown = findUnknownVariables(text);
  if (unknown.length > 0) {
    throw new DomainError("INVALID_PAYLOAD", `Variáveis desconhecidas no texto: ${unknown.map((v) => `{${v}}`).join(", ")}`, {
      unknownVariables: unknown,
    });
  }
}

export async function upsertBotText(tenantId: string, key: BotTextKeyLiteral, text: string) {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > 1000) {
    throw new DomainError("INVALID_PAYLOAD", "O texto precisa ter entre 1 e 1000 caracteres.");
  }
  assertKnownVariables(trimmed);

  return forTenant(tenantId).botText.upsert({
    where: { tenantId_key: { tenantId, key: key as BotTextKey } },
    update: { text: trimmed },
    create: { tenantId, key: key as BotTextKey, text: trimmed },
  });
}

/** "Restaurar padrão" (docs/arquitetura.md §6.7) — remove a edição do tenant, se existir. */
export async function resetBotText(tenantId: string, key: BotTextKeyLiteral) {
  await forTenant(tenantId).botText.deleteMany({ where: { key: key as BotTextKey } });
}

const PREVIEW_SAMPLE_VARS = {
  nome: "Maria",
  empresa: "Studio Bela",
  servico: "Corte feminino",
  profissional: "Ana",
  data: "Ter 30/09",
  hora: "14:30",
  preco: "R$ 80,00",
};

/** Pré-visualização com valores de exemplo (docs/arquitetura.md §6.7, tela de edição). */
export function previewBotText(text: string): { preview: string; unknownVariables: string[] } {
  const unknownVariables = findUnknownVariables(text);
  return { preview: renderTemplate(text, PREVIEW_SAMPLE_VARS), unknownVariables };
}
