import { NextResponse } from "next/server";
import { handleInternalRoute } from "@/lib/api-internal/respond";
import { CancelAppointmentRequestSchema } from "@/lib/api-internal/schemas";
import { cancelAppointmentBot } from "@/modules/bot-api/booking-bot";
import { resolveInternalRequest } from "@/modules/bot-api/internal-auth";

/** `POST /api/internal/v1/appointments/{id}/cancel` (docs/arquitetura.md §6.5) — idempotente. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const { id } = await params;
    const body = CancelAppointmentRequestSchema.parse(await req.json());
    const appointment = await cancelAppointmentBot(ctx, id, body.contactId);
    return NextResponse.json({ appointmentId: appointment.id, status: appointment.status }, { status: 200 });
  });
}
