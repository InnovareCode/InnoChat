import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";

export type ReminderSettings = { enabled: boolean; hoursBefore: number };

export async function getReminderSettings(tenantId: string): Promise<ReminderSettings> {
  const tenant = await getPrisma().tenant.findUnique({ where: { id: tenantId }, select: { reminderEnabled: true, reminderHoursBefore: true } });
  if (!tenant) throw new DomainError("NOT_FOUND", "Empresa não encontrada.");
  return { enabled: tenant.reminderEnabled, hoursBefore: tenant.reminderHoursBefore };
}

export async function updateReminderSettings(tenantId: string, input: ReminderSettings): Promise<ReminderSettings> {
  const updated = await getPrisma().tenant.update({
    where: { id: tenantId },
    data: { reminderEnabled: input.enabled, reminderHoursBefore: input.hoursBefore },
    select: { reminderEnabled: true, reminderHoursBefore: true },
  });
  return { enabled: updated.reminderEnabled, hoursBefore: updated.reminderHoursBefore };
}
