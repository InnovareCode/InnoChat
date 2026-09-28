import { DomainError } from "@/lib/errors";
import type { InternalApiContext } from "./internal-auth";

/**
 * `POST /sandbox/outbox` (docs/arquitetura.md §6.8, §8): guarda as mensagens que o workflow
 * teria enviado pela Evolution, para a bateria de roteiros (Fase 6, Íris) ler e comparar.
 * Purga em 24h.
 *
 * DÍVIDA CONSCIENTE (registrar para Cronos/Atlas): guardado em memória do processo, não em
 * tabela — o schema desta fase não tem um model para isso (dado de teste, TTL curto, não é
 * garantia de negócio). Não sobrevive a um restart/deploy nem escala a múltiplas instâncias do
 * processo Next. Se isso incomodar a Fase 6, a solução é uma migration nova (`SandboxOutboxEntry`
 * com `whatsappInstanceId`, `sessionId`, `message`, `createdAt`) — pedir ao Cronos.
 *
 * A leitura (`readSandboxOutbox`) e a rota GET NÃO estão em docs/arquitetura.md §6.8 (que só
 * descreve o POST) — é uma extensão pragmática desta implementação para a bateria de roteiros
 * conseguir "ler o outbox e comparar" (§8) sem precisar inventar outro canal. Documentado no
 * OpenAPI e no handoff; o Atlas/Íris podem remover se decidirem por outro desenho na Fase 6.
 */

type OutboxEntry = { sessionId: string; message: string; at: number };

const TTL_MS = 24 * 60 * 60 * 1000;
const store = new Map<string, OutboxEntry[]>();

function prune(entries: OutboxEntry[], now: number): OutboxEntry[] {
  return entries.filter((e) => now - e.at < TTL_MS);
}

export function pushSandboxOutbox(ctx: InternalApiContext, sessionId: string, messages: string[]): { accepted: number } {
  if (!ctx.instance.sandbox) {
    throw new DomainError("FORBIDDEN", "Este endpoint só aceita instâncias sandbox.");
  }
  const now = Date.now();
  const kept = prune(store.get(ctx.instance.id) ?? [], now);
  const added = messages.map((message) => ({ sessionId, message, at: now }));
  store.set(ctx.instance.id, [...kept, ...added]);
  return { accepted: messages.length };
}

export function readSandboxOutbox(ctx: InternalApiContext, sessionId?: string): { messages: { sessionId: string; message: string; at: string }[] } {
  const now = Date.now();
  const entries = prune(store.get(ctx.instance.id) ?? [], now);
  store.set(ctx.instance.id, entries);
  const filtered = sessionId ? entries.filter((e) => e.sessionId === sessionId) : entries;
  return { messages: filtered.map((e) => ({ sessionId: e.sessionId, message: e.message, at: new Date(e.at).toISOString() })) };
}
