import { NextResponse } from "next/server";
import { handleInternalRoute } from "@/lib/api-internal/respond";
import { ContactAppointmentsQuerySchema } from "@/lib/api-internal/schemas";
import { listMyAppointmentOptions } from "@/modules/bot-api/booking-bot";
import { resolveInternalRequest } from "@/modules/bot-api/internal-auth";

/** `GET /api/internal/v1/contacts/{contactId}/appointments` (docs/arquitetura.md §6.5). */
export async function GET(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const { contactId } = await params;
    const url = new URL(req.url);
    const query = ContactAppointmentsQuerySchema.parse(Object.fromEntries(url.searchParams));
    const result = await listMyAppointmentOptions(ctx.tenantId, contactId, query.upcoming);
    return NextResponse.json(result, { status: 200 });
  });
}
