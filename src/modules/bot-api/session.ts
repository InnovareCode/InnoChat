import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { notFound, type InternalApiContext } from "./internal-auth";
import { appendRecentOutbound } from "./claim";

/**
 * Carrega a `ChatSession` já validada como pertencente à instância resolvida pelo token
 * (docs/arquitetura.md §6.1 — "todo ID recebido é revalidado contra o tenant da instância").
 * `ChatSession` não tem `tenantId` próprio (ver
 * `.claude/agent-memory/vega/for_tenant_scope_limits.md`) — o escopo é por `whatsappInstanceId`.
 */
async function loadOwnedSession(ctx: InternalApiContext, sessionId: string) {
  const session = await getPrisma().chatSession.findUnique({ where: { id: sessionId } });
  if (!session || session.whatsappInstanceId !== ctx.instance.id) {
    notFound("Sessão não encontrada.");
  }
  return session;
}

export type UpdateSessionInput = {
  lockToken: string;
  version: number;
  state: string;
  context: unknown;
  invalidCount: number;
  outbound: string[];
  handoff: boolean;
};

/**
 * `PUT /sessions/{id}` (docs/arquitetura.md §6.3): grava e libera a trava. `409 LOCK_LOST`
 * (mapeado pela rota) se a trava já venceu ou a versão não bate — nesse caso o n8n **não
 * envia** e encerra a execução, então esta função não grava NADA quando isso acontece.
 */
export async function updateSession(ctx: InternalApiContext, sessionId: string, input: UpdateSessionInput) {
  const session = await loadOwnedSession(ctx, sessionId);
  const now = new Date();

  const lockValid = session.lockToken === input.lockToken && !!session.lockedUntil && session.lockedUntil > now;
  const versionValid = session.version === input.version;
  if (!lockValid || !versionValid) {
    throw new DomainError("LOCK_LOST", "A trava da sessão venceu ou a versão está desatualizada.");
  }

  const prisma = getPrisma();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId } });

  const recentOutbound = appendRecentOutbound(session.recentOutbound, input.outbound, now);
  const humanUntil = input.handoff ? new Date(now.getTime() + tenant.humanPauseMin * 60_000) : session.humanUntil;

  const updated = await prisma.chatSession.update({
    where: { id: sessionId },
    data: {
      state: input.handoff ? "HUMAN" : input.state,
      context: input.context as object,
      invalidCount: input.invalidCount,
      version: { increment: 1 },
      lockToken: null,
      lockedUntil: null,
      recentOutbound,
      humanUntil,
    },
  });

  return { version: updated.version };
}

/**
 * `POST /sessions/{id}/release` (docs/arquitetura.md §6.3): libera sem gravar, chamado pelo
 * caminho de erro do workflow. **Sempre idempotente** — mesmo se a trava já não existir mais
 * (venceu, ou já foi liberada), devolve `200` sem erro; só falha (404) se a sessão não for desta
 * instância.
 */
export async function releaseSession(ctx: InternalApiContext, sessionId: string, lockToken: string) {
  const session = await loadOwnedSession(ctx, sessionId);

  if (session.lockToken !== lockToken) {
    // Já foi liberada, ou a trava é de outra execução (venceu e outra pegou) — idempotente por
    // design: não é erro do chamador, é exatamente o cenário que este endpoint existe para
    // cobrir sem risco.
    return { released: true };
  }

  await getPrisma().chatSession.update({ where: { id: sessionId }, data: { lockToken: null, lockedUntil: null } });
  return { released: true };
}
