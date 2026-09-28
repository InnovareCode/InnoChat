import { createHash, randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import type { InboundIgnoreReason } from "@/lib/db/types";
import { normalizeEvolutionMessage, resolveSenderIdentity, digitsFromJid, type NormalizedMessage } from "@/core/bot/evolution-normalize";
import { getMergedBotTexts } from "@/modules/bot-texts/service";
import { isTenantBotAllowed } from "./subscription-gate";
import type { InternalApiContext } from "./internal-auth";

const LEASE_MS = 20_000;
const STALE_MS = 5 * 60 * 1000;
const ECHO_WINDOW_MS = 2 * 60 * 1000;
const RECENT_OUTBOUND_MAX = 20;

export type ClaimProcessResult = {
  action: "process";
  inboundEventId: string;
  instance: { name: string; sandbox: boolean };
  to: string;
  message: { type: "text"; text: string } | { type: "media" };
  contact: { id: string; name: string | null; pushName: string | null };
  session: {
    id: string;
    state: string;
    context: unknown;
    invalidCount: number;
    version: number;
    lockToken: string;
    expired: boolean;
  };
  tenant: { name: string; askProfessional: boolean; timezone: string };
  texts: Record<string, string>;
};

export type ClaimResult =
  | ClaimProcessResult
  | { action: "busy"; retryAfterMs: number }
  | { action: "ignore"; reason: InboundIgnoreReason | "UNSUPPORTED_EVENT" | "GROUP" };

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Detecta `PrismaClientKnownRequestError` com `code === "P2002"` (unique constraint) por
 * assinatura, sem `instanceof` de `@prisma/client` (proibido fora de `src/lib/db/`, ver
 * eslint.config.mjs) — mesmo padrão de `isExclusionViolation` em
 * `src/modules/agenda/appointments.ts`, documentado em
 * `.claude/agent-memory/vega/prisma_exclude_violation_shape.md`.
 */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.constructor?.name === "PrismaClientKnownRequestError" && (error as unknown as { code?: string }).code === "P2002";
}

function isRecentOutboundEcho(recentOutbound: unknown, content: NormalizedMessage["content"], now: Date): boolean {
  if (content.type !== "text") return false;
  if (!Array.isArray(recentOutbound)) return false;
  const hash = sha256Hex(content.text);
  return recentOutbound.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as { hash?: unknown; at?: unknown };
    if (e.hash !== hash || typeof e.at !== "string") return false;
    const at = new Date(e.at).getTime();
    return Number.isFinite(at) && now.getTime() - at <= ECHO_WINDOW_MS;
  });
}

/** Mantém só as saídas dos últimos `ECHO_WINDOW_MS`, cortado por tamanho — usado por `session.ts` ao salvar `outbound`. */
export function appendRecentOutbound(recentOutbound: unknown, texts: string[], now: Date): { hash: string; at: string }[] {
  const previous = Array.isArray(recentOutbound) ? (recentOutbound as { hash?: unknown; at?: unknown }[]) : [];
  const kept = previous
    .filter((e) => typeof e.hash === "string" && typeof e.at === "string" && now.getTime() - new Date(e.at as string).getTime() <= ECHO_WINDOW_MS)
    .map((e) => ({ hash: e.hash as string, at: e.at as string }));
  const added = texts.map((t) => ({ hash: sha256Hex(t), at: now.toISOString() }));
  return [...kept, ...added].slice(-RECENT_OUTBOUND_MAX);
}

/**
 * `POST /messages/claim` (docs/arquitetura.md §6.2): normaliza o payload da Evolution,
 * deduplica, resolve o remetente (inclusive `@lid`), adquire a trava (lease de 20s) da sessão,
 * avalia expiração/modo humano/eco/assinatura, e devolve tudo que o n8n precisa para decidir o
 * próximo passo. NUNCA lança para payload irreconhecível — sempre `ignore`.
 */
export async function claimMessage(ctx: InternalApiContext, rawPayload: unknown): Promise<ClaimResult> {
  const prisma = getPrisma();
  const now = new Date();

  const normalized = normalizeEvolutionMessage(rawPayload);
  if (normalized.kind === "unsupported") {
    return { action: "ignore", reason: normalized.reason };
  }

  // Dedupe (docs/arquitetura.md §2 regra 1) — caminho rápido; a constraint única no banco é o
  // backstop final contra corrida (ver isUniqueViolation abaixo).
  const existing = await prisma.inboundEvent.findUnique({
    where: { whatsappInstanceId_providerMessageId: { whatsappInstanceId: ctx.instance.id, providerMessageId: normalized.providerMessageId } },
  });
  if (existing) {
    return { action: "ignore", reason: "DUPLICATE" };
  }

  const identity = resolveSenderIdentity(normalized);
  let contact = identity.waJid
    ? await prisma.contact.findFirst({ where: { tenantId: ctx.tenantId, waJid: identity.waJid } })
    : await prisma.contact.findFirst({ where: { tenantId: ctx.tenantId, lid: identity.lid ?? undefined } });

  if (!identity.waJid && !contact) {
    return recordSimpleIgnore(ctx, normalized.providerMessageId, "UNRESOLVABLE_SENDER");
  }

  const waJid = identity.waJid ?? contact!.waJid;
  contact = await prisma.contact.upsert({
    where: { tenantId_waJid: { tenantId: ctx.tenantId, waJid } },
    update: {
      ...(normalized.pushName ? { pushName: normalized.pushName } : {}),
      ...(identity.lid ? { lid: identity.lid } : {}),
    },
    create: { tenantId: ctx.tenantId, waJid, lid: identity.lid, pushName: normalized.pushName },
  });

  // Sessão + trava (lease de 20s, docs/arquitetura.md §2 regra 2). `update: {}` no upsert é
  // proposital: não toca `lastInboundAt` numa sessão já existente, para podermos comparar contra
  // o valor ANTERIOR (detectar expiração) antes de gravar o novo abaixo.
  const session = await prisma.chatSession.upsert({
    where: { whatsappInstanceId_contactId: { whatsappInstanceId: ctx.instance.id, contactId: contact.id } },
    update: {},
    create: { whatsappInstanceId: ctx.instance.id, contactId: contact.id, state: "MAIN_MENU", lastInboundAt: now },
  });

  const lockToken = randomUUID();
  const leaseResult = await prisma.chatSession.updateMany({
    where: { id: session.id, OR: [{ lockToken: null }, { lockedUntil: { lt: now } }] },
    data: { lockToken, lockedUntil: new Date(now.getTime() + LEASE_MS) },
  });
  if (leaseResult.count === 0) {
    // Trava de outra execução — nada foi gravado (docs/arquitetura.md §2 regra 2).
    return { action: "busy", retryAfterMs: 1500 };
  }

  const locked = await prisma.chatSession.findUniqueOrThrow({ where: { id: session.id } });
  const stateBefore = locked.state;
  // Captura fora do closure: `normalized` é `NormalizedMessage` neste ponto (já retornamos para
  // `unsupported` acima), mas o TypeScript não propaga esse estreitamento para dentro de uma
  // `function` aninhada — capturar o campo primitivo evita o erro sem precisar de asserção.
  const providerMessageId = normalized.providerMessageId;

  async function finishIgnore(reason: InboundIgnoreReason): Promise<ClaimResult> {
    try {
      await prisma.$transaction([
        prisma.chatSession.update({ where: { id: session.id }, data: { lockToken: null, lockedUntil: null } }),
        prisma.inboundEvent.create({
          data: {
            whatsappInstanceId: ctx.instance.id,
            providerMessageId,
            outcome: "IGNORE",
            reason,
            stateBefore,
            stateAfter: stateBefore,
          },
        }),
      ]);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Corrida rara: outra execução para o MESMO providerMessageId já gravou o InboundEvent
      // entre o dedupe rápido e agora. Libera a trava que acabamos de adquirir e devolve
      // DUPLICATE — nunca deixa a sessão travada por isso.
      await prisma.chatSession.update({ where: { id: session.id }, data: { lockToken: null, lockedUntil: null } });
      return { action: "ignore", reason: "DUPLICATE" };
    }
    return { action: "ignore", reason };
  }

  if (contact.botPausedUntil && contact.botPausedUntil > now) {
    return finishIgnore("BOT_PAUSED");
  }

  if (locked.state === "HUMAN" && locked.humanUntil && locked.humanUntil > now) {
    return finishIgnore("HUMAN_MODE");
  }

  if (normalized.fromMe) {
    if (isRecentOutboundEcho(locked.recentOutbound, normalized.content, now)) {
      return finishIgnore("FROM_ME_ECHO");
    }

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
    const humanUntil = new Date(now.getTime() + tenant.humanPauseMin * 60_000);
    try {
      await prisma.$transaction([
        prisma.chatSession.update({
          where: { id: session.id },
          data: { state: "HUMAN", humanUntil, lockToken: null, lockedUntil: null },
        }),
        prisma.contact.update({ where: { id: contact.id }, data: { botPausedUntil: humanUntil } }),
        prisma.inboundEvent.create({
          data: {
            whatsappInstanceId: ctx.instance.id,
            providerMessageId,
            outcome: "IGNORE",
            reason: "HUMAN_TOOK_OVER",
            stateBefore,
            stateAfter: "HUMAN",
          },
        }),
      ]);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await prisma.chatSession.update({ where: { id: session.id }, data: { lockToken: null, lockedUntil: null } });
      return { action: "ignore", reason: "DUPLICATE" };
    }
    return { action: "ignore", reason: "HUMAN_TOOK_OVER" };
  }

  if (!(await isTenantBotAllowed(ctx.tenantId))) {
    return finishIgnore("TENANT_SUSPENDED");
  }

  if (now.getTime() - normalized.timestampMs > STALE_MS) {
    return finishIgnore("STALE");
  }

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });
  const expired = now.getTime() - locked.lastInboundAt.getTime() > tenant.sessionTimeoutMin * 60_000;

  const effectiveState = expired ? "MAIN_MENU" : locked.state;
  const effectiveContext = expired ? {} : locked.context;
  const effectiveInvalidCount = expired ? 0 : locked.invalidCount;

  let inboundEventId: string;
  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.chatSession.update({
        where: { id: session.id },
        data: {
          lastInboundAt: now,
          ...(expired ? { state: "MAIN_MENU", context: {}, invalidCount: 0 } : {}),
        },
      });
      return tx.inboundEvent.create({
        data: {
          whatsappInstanceId: ctx.instance.id,
          providerMessageId,
          outcome: "PROCESS",
          stateBefore,
          stateAfter: effectiveState,
        },
      });
    });
    inboundEventId = created.id;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    await prisma.chatSession.update({ where: { id: session.id }, data: { lockToken: null, lockedUntil: null } });
    return { action: "ignore", reason: "DUPLICATE" };
  }

  const texts = await getMergedBotTexts(ctx.tenantId);

  return {
    action: "process",
    inboundEventId,
    instance: { name: ctx.instance.instanceName, sandbox: ctx.instance.sandbox },
    to: digitsFromJid(waJid),
    message: normalized.content.type === "text" ? { type: "text", text: normalized.content.text } : { type: "media" },
    contact: { id: contact.id, name: contact.name, pushName: contact.pushName },
    session: {
      id: session.id,
      state: effectiveState,
      context: effectiveContext,
      invalidCount: effectiveInvalidCount,
      version: locked.version,
      lockToken,
      expired,
    },
    tenant: { name: tenant.name, askProfessional: tenant.askProfessional, timezone: tenant.timezone },
    texts,
  };
}

/**
 * Caminho de `UNRESOLVABLE_SENDER`: acontece ANTES de existir um `Contact`/`ChatSession` (não há
 * o que resolver), então só tenta registrar o `InboundEvent` de auditoria — sem trava para
 * liberar. Dedupe da própria corrida cai em `P2002` e é absorvido silenciosamente (o resultado
 * para o n8n é o mesmo `ignore` de qualquer forma).
 */
async function recordSimpleIgnore(ctx: InternalApiContext, providerMessageId: string, reason: InboundIgnoreReason): Promise<ClaimResult> {
  try {
    await getPrisma().inboundEvent.create({
      data: { whatsappInstanceId: ctx.instance.id, providerMessageId, outcome: "IGNORE", reason },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return { action: "ignore", reason };
}
