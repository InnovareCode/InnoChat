import { NextResponse } from "next/server";
import { handleInternalRoute } from "@/lib/api-internal/respond";
import { SandboxOutboxRequestSchema } from "@/lib/api-internal/schemas";
import { pushSandboxOutbox, readSandboxOutbox } from "@/modules/bot-api/sandbox-outbox";
import { resolveInternalRequest } from "@/modules/bot-api/internal-auth";

/** `POST /api/internal/v1/sandbox/outbox` (docs/arquitetura.md §6.8) — só instância `sandbox=true`. */
export async function POST(req: Request) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const body = SandboxOutboxRequestSchema.parse(await req.json());
    const result = pushSandboxOutbox(ctx, body.sessionId, body.messages);
    return NextResponse.json(result, { status: 200 });
  });
}

/**
 * `GET /api/internal/v1/sandbox/outbox?sessionId=` — extensão desta implementação (não está em
 * docs/arquitetura.md §6.8) para a bateria de roteiros da Fase 6 conseguir ler o que foi
 * "enviado" e comparar (§8). Ver a nota de dívida em `src/modules/bot-api/sandbox-outbox.ts`.
 */
export async function GET(req: Request) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const sessionId = new URL(req.url).searchParams.get("sessionId") ?? undefined;
    const result = readSandboxOutbox(ctx, sessionId);
    return NextResponse.json(result, { status: 200 });
  });
}
