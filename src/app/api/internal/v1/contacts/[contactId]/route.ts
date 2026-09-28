import { NextResponse } from "next/server";
import { handleInternalRoute } from "@/lib/api-internal/respond";
import { UpdateContactRequestSchema } from "@/lib/api-internal/schemas";
import { updateContactName } from "@/modules/bot-api/contacts-bot";
import { resolveInternalRequest } from "@/modules/bot-api/internal-auth";

/** `PATCH /api/internal/v1/contacts/{contactId}` (docs/arquitetura.md §6.5). */
export async function PATCH(req: Request, { params }: { params: Promise<{ contactId: string }> }) {
  return handleInternalRoute(req, async () => {
    const ctx = await resolveInternalRequest(req);
    const { contactId } = await params;
    const body = UpdateContactRequestSchema.parse(await req.json());
    await updateContactName(ctx.tenantId, contactId, body.name);
    return NextResponse.json({}, { status: 200 });
  });
}
