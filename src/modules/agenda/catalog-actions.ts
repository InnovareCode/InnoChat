"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import {
  createProfessional,
  createScheduleException,
  createService,
  deleteProfessional,
  deleteScheduleException,
  deleteService,
  listProfessionals,
  listScheduleExceptions,
  listServices,
  setProfessionalServices,
  setProfessionalWorkingHours,
  updateProfessional,
  updateService,
} from "./catalog";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const serviceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  durationMin: z.coerce.number().int().min(5).max(24 * 60),
  bufferAfterMin: z.coerce.number().int().min(0).max(24 * 60).default(0),
  priceCents: z.coerce.number().int().min(0).nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export async function listServicesAction(tenantSlug: string): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    return listServices(tenant.id);
  });
}

export async function createServiceAction(tenantSlug: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = serviceSchema.parse(input);
    return createService(tenant.id, { ...data, priceCents: data.priceCents ?? null });
  });
}

export async function updateServiceAction(tenantSlug: string, serviceId: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = serviceSchema.partial().parse(input);
    return updateService(tenant.id, serviceId, data);
  });
}

export async function deleteServiceAction(tenantSlug: string, serviceId: string): Promise<Result<{ id: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    await deleteService(tenant.id, serviceId);
    return { id: serviceId };
  });
}

// ---------------------------------------------------------------------------
// Professional
// ---------------------------------------------------------------------------

const professionalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export async function listProfessionalsAction(tenantSlug: string): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    return listProfessionals(tenant.id);
  });
}

export async function createProfessionalAction(tenantSlug: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = professionalSchema.parse(input);
    return createProfessional(tenant.id, data);
  });
}

export async function updateProfessionalAction(tenantSlug: string, professionalId: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = professionalSchema.partial().parse(input);
    return updateProfessional(tenant.id, professionalId, data);
  });
}

export async function deleteProfessionalAction(tenantSlug: string, professionalId: string): Promise<Result<{ id: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    await deleteProfessional(tenant.id, professionalId);
    return { id: professionalId };
  });
}

const serviceIdsSchema = z.object({ serviceIds: z.array(z.string().min(1)) });

export async function setProfessionalServicesAction(tenantSlug: string, professionalId: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = serviceIdsSchema.parse(input);
    return setProfessionalServices(tenant.id, professionalId, data.serviceIds);
  });
}

const workingHourSchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm"),
});
const workingHoursSchema = z.object({ hours: z.array(workingHourSchema).max(7 * 4) });

export async function setProfessionalWorkingHoursAction(tenantSlug: string, professionalId: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = workingHoursSchema.parse(input);
    return setProfessionalWorkingHours(tenant.id, professionalId, data.hours);
  });
}

// ---------------------------------------------------------------------------
// ScheduleException
// ---------------------------------------------------------------------------

const scheduleExceptionSchema = z.object({
  professionalId: z.string().min(1).nullable().default(null),
  type: z.enum(["BLOCK", "HOLIDAY"]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  reason: z.string().trim().max(255).nullable().optional(),
});

export async function listScheduleExceptionsAction(
  tenantSlug: string,
  range?: { from: string; to: string },
): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const parsedRange = range ? { from: new Date(range.from), to: new Date(range.to) } : undefined;
    return listScheduleExceptions(tenant.id, parsedRange);
  });
}

export async function createScheduleExceptionAction(tenantSlug: string, input: unknown): Promise<Result<unknown>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = scheduleExceptionSchema.parse(input);
    return createScheduleException(tenant.id, { ...data, reason: data.reason ?? null });
  });
}

export async function deleteScheduleExceptionAction(tenantSlug: string, exceptionId: string): Promise<Result<{ id: string }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    await deleteScheduleException(tenant.id, exceptionId);
    return { id: exceptionId };
  });
}
