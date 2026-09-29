"use server";

import { z } from "zod";
import { requireTenantMember } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { assertTenantCanWrite } from "@/modules/billing/service";
import { REMINDER_MAX_HOURS_BEFORE, REMINDER_MIN_HOURS_BEFORE } from "@/core/reminders/window";
import { getReminderSettings, updateReminderSettings, type ReminderSettings } from "./service";

export type { ReminderSettings };

const tenantSlugSchema = z.object({ tenantSlug: z.string().min(1).max(100) });

const updateSchema = tenantSlugSchema.extend({
  enabled: z.boolean(),
  hoursBefore: z.number().int().min(REMINDER_MIN_HOURS_BEFORE).max(REMINDER_MAX_HOURS_BEFORE),
});

/** Lembrete de véspera ao cliente final (WhatsApp) — leitura aberta a qualquer membro. */
export async function getReminderSettingsAction(input: unknown): Promise<Result<ReminderSettings>> {
  return runAction(async () => {
    const { tenantSlug } = tenantSlugSchema.parse(input);
    const { tenant } = await requireTenantMember(tenantSlug);
    return getReminderSettings(tenant.id);
  });
}

/** Só OWNER edita; painel suspenso é somente leitura. */
export async function updateReminderSettingsAction(input: unknown): Promise<Result<ReminderSettings>> {
  return runAction(async () => {
    const data = updateSchema.parse(input);
    const { tenant } = await requireTenantMember(data.tenantSlug, ["OWNER"]);
    await assertTenantCanWrite(tenant.id);
    return updateReminderSettings(tenant.id, { enabled: data.enabled, hoursBefore: data.hoursBefore });
  });
}
