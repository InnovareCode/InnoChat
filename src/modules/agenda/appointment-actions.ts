"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { assertTenantCanWrite } from "@/modules/billing/service";
import { cancelAppointment, createAppointmentManual, listAppointments, rescheduleAppointment } from "./appointments";

const listSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  professionalId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function listAppointmentsAction(tenantSlug: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = listSchema.parse(input);
    return listAppointments(tenant.id, data);
  });
}

const createAppointmentSchema = z.object({
  contactId: z.string().min(1).optional(),
  contactName: z.string().trim().min(1).max(120).optional(),
  contactPhoneE164: z.string().trim().max(20).optional(),
  serviceId: z.string().min(1),
  professionalId: z.string().min(1).nullable(),
  startsAt: z.coerce.date(),
  idempotencyKey: z.string().min(1).max(200).optional(),
});

export async function createAppointmentAction(tenantSlug: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant, user } = await requireTenantMember(tenantSlug);
    await assertTenantCanWrite(tenant.id);
    const data = createAppointmentSchema.parse(input);
    return createAppointmentManual(tenant.id, data, user.id);
  });
}

const cancelSchema = z.object({ note: z.string().trim().max(500).optional() });

export async function cancelAppointmentAction(tenantSlug: string, appointmentId: string, input?: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant, user } = await requireTenantMember(tenantSlug);
    await assertTenantCanWrite(tenant.id);
    const data = cancelSchema.parse(input ?? {});
    return cancelAppointment(tenant.id, appointmentId, user.id, data.note);
  });
}

const rescheduleSchema = z.object({ startsAt: z.coerce.date() });

export async function rescheduleAppointmentAction(tenantSlug: string, appointmentId: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant, user } = await requireTenantMember(tenantSlug);
    await assertTenantCanWrite(tenant.id);
    const data = rescheduleSchema.parse(input);
    return rescheduleAppointment(tenant.id, appointmentId, data.startsAt, user.id);
  });
}
