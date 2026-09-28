import { NextResponse } from "next/server";
import { handleInternalRoute } from "@/lib/api-internal/respond";
import { AvailabilityDaysQuerySchema } from "@/lib/api-internal/schemas";
import { listAvailabilityDayOptions } from "@/modules/bot-api/booking-bot";
import { resolveInternalRequest } from "@/modules/bot-api/internal-auth";

/** `GET /api/internal/v1/availability/days` (docs/arquitetura.md §6.4). */
export async function GET(req: Request) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const url = new URL(req.url);
    const query = AvailabilityDaysQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listAvailabilityDayOptions(ctx.tenantId, {
      serviceId: query.serviceId,
      professionalId: query.professionalId ?? null,
      from: query.from,
      limit: query.limit,
    });
    return NextResponse.json(result, { status: 200 });
  });
}
