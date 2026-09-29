/**
 * Normalização PURA do payload de webhook da Evolution API v2 (docs/arquitetura.md §6.9).
 * Sem I/O, sem Prisma, sem Next — só transforma o corpo bruto do webhook num formato estável
 * que `src/modules/bot-api/claim.ts` consome. Isolado de propósito: quando os payloads REAIS
 * chegarem (Fase 0, ainda pendente — ver `fixtures/evolution/README.md`), só este arquivo (e as
 * fixtures) deve precisar mudar.
 *
 * Formato esperado (arquitetura.md §6.9, baseado na documentação pública — NÃO capturado do
 * servidor real ainda):
 *   { event, instance, data: { key: { remoteJid, remoteJidAlt?, fromMe, id }, pushName,
 *     message: { conversation | extendedTextMessage.text }, messageType, messageTimestamp },
 *     date_time, apikey }
 */

/** `label` = marcador de exibição para o histórico ("[imagem]"...) — nunca o binário nem a legenda. */
export type NormalizedMessageContent = { type: "text"; text: string } | { type: "media"; label: string };

const MEDIA_LABELS: Record<string, string> = {
  imageMessage: "[imagem]",
  audioMessage: "[áudio]",
  videoMessage: "[vídeo]",
  documentMessage: "[documento]",
  documentWithCaptionMessage: "[documento]",
  stickerMessage: "[figurinha]",
  ptvMessage: "[vídeo]",
  contactMessage: "[contato]",
  locationMessage: "[localização]",
};

export type NormalizedMessage = {
  kind: "message";
  providerMessageId: string;
  fromMe: boolean;
  /** `key.remoteJid` exatamente como recebido — pode terminar em `@lid`, `@s.whatsapp.net` etc. */
  jid: string;
  /** `key.remoteJidAlt` ou `data.senderPn`, quando presentes (resolução de `@lid`, §6.9). */
  altJid: string | null;
  pushName: string | null;
  /** Instante da mensagem, já em milissegundos (a Evolution manda em segundos). */
  timestampMs: number;
  content: NormalizedMessageContent;
};

export type NormalizedUnsupported = {
  kind: "unsupported";
  /** `GROUP` quando reconhecemos o evento mas é de um grupo (`@g.us`); `UNSUPPORTED_EVENT` para
   * qualquer outra coisa que não seja uma mensagem individual reconhecível. */
  reason: "GROUP" | "UNSUPPORTED_EVENT";
};

export type NormalizedEvolutionEvent = NormalizedMessage | NormalizedUnsupported;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    // A Evolution manda `messageTimestamp` em segundos (padrão do WhatsApp/Baileys); valores já
    // em milissegundos (> ~10^12) são aceitos sem conversão, defensivamente.
    return value > 1e12 ? value : value * 1000;
  }
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return normalizeTimestamp(Number(value));
  }
  return Date.now();
}

function extractContent(message: unknown): NormalizedMessageContent {
  if (!isRecord(message)) return { type: "media", label: "[mídia]" };
  if (typeof message.conversation === "string" && message.conversation.length > 0) {
    return { type: "text", text: message.conversation };
  }
  const extended = message.extendedTextMessage;
  if (isRecord(extended) && typeof extended.text === "string" && extended.text.length > 0) {
    return { type: "text", text: extended.text };
  }
  // Qualquer outro tipo (imageMessage, videoMessage, audioMessage, documentMessage,
  // stickerMessage, ...) vira "media" — o n8n responde com o texto ONLY_TEXT (§2 regra 6).
  const known = Object.keys(MEDIA_LABELS).find((k) => k in message);
  return { type: "media", label: known ? MEDIA_LABELS[known] : "[mídia]" };
}

/**
 * Extrai a mensagem individual de um evento `messages.upsert`. Qualquer formato inesperado
 * (evento diferente, corpo malformado, sem `data`/`key`) vira `unsupported/UNSUPPORTED_EVENT` —
 * NUNCA lança. É essa garantia que permite ao endpoint `/messages/claim` nunca devolver 5xx para
 * um payload irreconhecível (docs/arquitetura.md §6.2).
 */
export function normalizeEvolutionMessage(payload: unknown): NormalizedEvolutionEvent {
  if (!isRecord(payload)) return { kind: "unsupported", reason: "UNSUPPORTED_EVENT" };
  if (payload.event !== "messages.upsert") return { kind: "unsupported", reason: "UNSUPPORTED_EVENT" };

  const data = payload.data;
  if (!isRecord(data)) return { kind: "unsupported", reason: "UNSUPPORTED_EVENT" };

  const key = data.key;
  if (!isRecord(key)) return { kind: "unsupported", reason: "UNSUPPORTED_EVENT" };

  const remoteJid = typeof key.remoteJid === "string" && key.remoteJid.length > 0 ? key.remoteJid : null;
  const providerMessageId = typeof key.id === "string" && key.id.length > 0 ? key.id : null;
  if (!remoteJid || !providerMessageId) return { kind: "unsupported", reason: "UNSUPPORTED_EVENT" };

  if (remoteJid.endsWith("@g.us")) return { kind: "unsupported", reason: "GROUP" };

  const altJidRaw =
    (typeof key.remoteJidAlt === "string" && key.remoteJidAlt) ||
    (typeof data.senderPn === "string" && data.senderPn) ||
    null;

  return {
    kind: "message",
    providerMessageId,
    fromMe: key.fromMe === true,
    jid: remoteJid,
    altJid: altJidRaw,
    pushName: typeof data.pushName === "string" ? data.pushName : null,
    timestampMs: normalizeTimestamp(data.messageTimestamp),
    content: extractContent(data.message),
  };
}

/**
 * Identidade a usar para resolver/gravar o `Contact` (docs/arquitetura.md §6.9, "@lid"):
 * - JID normal (`...@s.whatsapp.net`) → usa direto, sem `lid`.
 * - JID `@lid` COM alternativa (`remoteJidAlt`/`senderPn`) → usa a alternativa como `waJid` e
 *   guarda o `@lid` original em `Contact.lid` (para reconhecer da próxima vez, se a Evolution
 *   parar de mandar a alternativa).
 * - JID `@lid` SEM alternativa → não dá pra resolver um `waJid` novo aqui; o chamador procura um
 *   `Contact.lid` já conhecido, e se não achar, é `UNRESOLVABLE_SENDER`.
 */
export function resolveSenderIdentity(message: NormalizedMessage): { waJid: string | null; lid: string | null } {
  if (message.jid.endsWith("@lid")) {
    if (message.altJid) return { waJid: message.altJid, lid: message.jid };
    return { waJid: null, lid: message.jid };
  }
  return { waJid: message.jid, lid: null };
}

/** Dígitos do JID, exatamente como recebido (docs/arquitetura.md §6.9) — só para exibição/envio. */
export function digitsFromJid(jid: string): string {
  return jid.split("@")[0] ?? jid;
}
