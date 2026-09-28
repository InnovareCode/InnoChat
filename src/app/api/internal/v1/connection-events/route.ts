import { NextResponse } from "next/server";
import { handleInternalRoute } from "@/lib/api-internal/respond";
import { ConnectionEventRequestSchema } from "@/lib/api-internal/schemas";
import { applyConnectionEvent } from "@/modules/bot-api/connection-events";
import { resolveInternalRequest } from "@/modules/bot-api/internal-auth";

/** `POST /api/internal/v1/connection-events` (docs/arquitetura.md §6.8) — devolve 200 sempre. */
export async function POST(req: Request) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const body = ConnectionEventRequestSchema.parse(await req.json().catch(() => ({})));
    const result = await applyConnectionEvent(ctx, body.payload);
    return NextResponse.json(result, { status: 200 });
  });
}
