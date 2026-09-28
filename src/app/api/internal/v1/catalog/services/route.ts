import { NextResponse } from "next/server";
import { handleInternalRoute } from "@/lib/api-internal/respond";
import { listCatalogServiceOptions } from "@/modules/bot-api/booking-bot";
import { resolveInternalRequest } from "@/modules/bot-api/internal-auth";

/** `GET /api/internal/v1/catalog/services` (docs/arquitetura.md §6.4). */
export async function GET(req: Request) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const result = await listCatalogServiceOptions(ctx.tenantId);
    return NextResponse.json(result, { status: 200 });
  });
}
