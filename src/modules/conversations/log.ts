import { forTenant } from "@/lib/db/tenant-client";
import { isUniqueViolation } from "@/lib/db/prisma-errors";
import { logger } from "@/lib/logger";

/**
 * Histórico de conversas do WhatsApp (LGPD: guardado 90 dias, ver `maintenance/tick.ts`).
 * Gravar o histórico é SEMPRE efeito colateral: nada aqui pode derrubar o fluxo do bot — falha
 * inesperada vira `logger.warn` (só ids/tipo do erro, nunca o texto da mensagem) e segue.
 */

export const CHAT_BODY_MAX = 4000;

export type ChatLogEntry = {
  tenantId: string;
  whatsappInstanceId: string | null;
  contactId: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string;
  /** Id da mensagem na Evolution — dedup (`@@unique([tenantId, providerMessageId])`). Nulo = sem dedup. */
  providerMessageId?: string | null;
};

function clamp(body: string): string {
  return body.length > CHAT_BODY_MAX ? body.slice(0, CHAT_BODY_MAX) : body;
}

/** `true` se gravou; `false` se era duplicata (P2002) ou se falhou (já logado). Nunca lança. */
export async function logChatMessage(entry: ChatLogEntry): Promise<boolean> {
  if (!entry.body) return false;
  try {
    await forTenant(entry.tenantId).chatMessage.create({
      data: {
        tenantId: entry.tenantId, // literal só para o TS; forTenant sobrescreve em runtime
        contactId: entry.contactId,
        whatsappInstanceId: entry.whatsappInstanceId,
        direction: entry.direction,
        body: clamp(entry.body),
        providerMessageId: entry.providerMessageId ?? null,
      },
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    logger.warn("conversations.log_failed", {
      direction: entry.direction,
      contactId: entry.contactId,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    });
    return false;
  }
}

/** Saída do bot: uma linha por texto, na ordem (createdAt escalonado em 1ms para manter a ordem estável). */
export async function logOutboundTexts(params: {
  tenantId: string;
  whatsappInstanceId: string;
  contactId: string;
  texts: string[];
}): Promise<void> {
  const base = Date.now();
  const texts = params.texts.filter((t) => t.length > 0);
  if (texts.length === 0) return;
  try {
    await forTenant(params.tenantId).chatMessage.createMany({
      data: texts.map((text, i) => ({
        tenantId: params.tenantId,
        contactId: params.contactId,
        whatsappInstanceId: params.whatsappInstanceId,
        direction: "OUTBOUND" as const,
        body: clamp(text),
        createdAt: new Date(base + i),
      })),
    });
  } catch (error) {
    logger.warn("conversations.log_outbound_failed", {
      contactId: params.contactId,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    });
  }
}
