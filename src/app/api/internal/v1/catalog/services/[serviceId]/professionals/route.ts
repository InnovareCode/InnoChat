import { NextResponse } from "next/server";
import { handleInternalRoute } from "@/lib/api-internal/respond";
import { listCatalogProfessionalOptions } from "@/modules/bot-api/booking-bot";
import { resolveInternalRequest } from "@/modules/bot-api/internal-auth";

/** `GET /api/internal/v1/catalog/services/{serviceId}/professionals` (docs/arquitetura.md §6.4). */
export async function GET(req: Request, { params }: { params: Promise<{ serviceId: string }> }) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const { serviceId } = await params;
    const result = await listCatalogProfessionalOptions(ctx.tenantId, serviceId);
    return NextResponse.json(result, { status: 200 });
  });
}
