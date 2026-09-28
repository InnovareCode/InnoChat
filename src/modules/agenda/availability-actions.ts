"use server";

import { z } from "zod";
import { computeAvailableDays, computeAvailableSlots } from "@/core/agenda";
import { requireTenantMember } from "@/lib/auth/guards";
import { getPrisma } from "@/lib/db/prisma";
import { forTenant } from "@/lib/db/tenant-client";
import { DomainError } from "@/lib/errors";
import { runAction, type Result } from "@/lib/result";
import { loadProfessionalScheduleInputs } from "./availability-loader";

/**
 * Substitui, por Server Action, a rota `GET /api/agenda/slots?…` cogitada em
 * docs/arquitetura.md §6.10 — o widget de "criar agendamento manual" do painel (Lyra) chama
 * isto direto, sem precisar de uma rota HTTP separada (Server Actions já servem Client
 * Components). Usado só pelo painel; a API interna do bot (n8n) tem seu próprio contrato na
 * Fase 4 (docs/arquitetura.md §6.4), reaproveitando as mesmas funções de `src/core/agenda`.
 */

const dateISORe = /^\d{4}-\d{2}-\d{2}$/;

async function resolveEligibleProfessionalIds(tenantId: string, serviceId: string, professionalId: string | null): Promise<string[]> {
  if (professionalId) {
    const professional = await forTenant(tenantId).professional.findFirst({ where: { id: professionalId, active: true } });
    if (!professional) throw new DomainError("NOT_FOUND", "Profissional não encontrado.");
    return [professionalId];
  }

  const links = await getPrisma().professionalService.findMany({
    where: { serviceId, professional: { tenantId, active: true } },
    select: { professionalId: true },
  });
  return Array.from(new Set(links.map((l) => l.professionalId)));
}

const slotsSchema = z.object({
  serviceId: z.string().min(1),
  professionalId: z.string().min(1).nullable(),
  date: z.string().regex(dateISORe, "date precisa estar no formato YYYY-MM-DD"),
});

export async function listAvailableSlotsAction(tenantSlug: string, input: unknown): Promise<Result<{ slots: string[] }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = slotsSchema.parse(input);

    const service = await forTenant(tenant.id).service.findFirst({ where: { id: data.serviceId, active: true } });
    if (!service) throw new DomainError("NOT_FOUND", "Serviço não encontrado.");

    const professionalIds = await resolveEligibleProfessionalIds(tenant.id, data.serviceId, data.professionalId);
    const now = new Date();
    const dayRange = { from: new Date(`${data.date}T00:00:00.000Z`), to: new Date(`${data.date}T23:59:59.999Z`) };
    // Margem de 1 dia de cada lado: o expediente local pode cruzar a data UTC (§14 do
    // arquitetura — mesma razão da "virada de dia" testada em core/agenda).
    const loadRange = { from: new Date(dayRange.from.getTime() - 86_400_000), to: new Date(dayRange.to.getTime() + 86_400_000) };

    const tenantRow = await getPrisma().tenant.findUniqueOrThrow({ where: { id: tenant.id } });

    const allSlots = new Set<number>();
    for (const professionalId of professionalIds) {
      const { workingHourRules, closedRanges, busy } = await loadProfessionalScheduleInputs(tenant.id, professionalId, loadRange);
      const slots = computeAvailableSlots({
        dateISO: data.date,
        timezone: tenant.timezone,
        workingHours: workingHourRules,
        closedRanges,
        busy,
        serviceDurationMin: service.durationMin,
        slotGranularityMin: tenantRow.slotGranularityMin,
        minLeadTimeMin: tenantRow.minLeadTimeMin,
        now,
      });
      for (const s of slots) allSlots.add(s.getTime());
    }

    return { slots: Array.from(allSlots).sort((a, b) => a - b).map((t) => new Date(t).toISOString()) };
  });
}

const daysSchema = z.object({
  serviceId: z.string().min(1),
  professionalId: z.string().min(1).nullable(),
  from: z.string().regex(dateISORe, "from precisa estar no formato YYYY-MM-DD"),
  limit: z.coerce.number().int().min(1).max(30).default(7),
});

export async function listAvailableDaysAction(tenantSlug: string, input: unknown): Promise<Result<{ days: string[]; hasMore: boolean }>> {
  return runAction(async () => {
    const { tenant } = await requireTenantMember(tenantSlug);
    const data = daysSchema.parse(input);

    const service = await forTenant(tenant.id).service.findFirst({ where: { id: data.serviceId, active: true } });
    if (!service) throw new DomainError("NOT_FOUND", "Serviço não encontrado.");

    const tenantRow = await getPrisma().tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    const professionalIds = await resolveEligibleProfessionalIds(tenant.id, data.serviceId, data.professionalId);
    if (professionalIds.length === 0) {
      return { days: [], hasMore: false };
    }

    const now = new Date();
    const horizonEnd = new Date(now.getTime() + (tenantRow.maxHorizonDays + 2) * 86_400_000);
    const loadRange = { from: new Date(now.getTime() - 86_400_000), to: horizonEnd };

    const daysWithSlot = new Set<string>();
    for (const professionalId of professionalIds) {
      const { workingHourRules, closedRanges, busy } = await loadProfessionalScheduleInputs(tenant.id, professionalId, loadRange);
      const { days } = computeAvailableDays({
        timezone: tenantRow.timezone,
        workingHours: workingHourRules,
        closedRanges,
        busy,
        serviceDurationMin: service.durationMin,
        slotGranularityMin: tenantRow.slotGranularityMin,
        minLeadTimeMin: tenantRow.minLeadTimeMin,
        maxHorizonDays: tenantRow.maxHorizonDays,
        now,
        fromDateISO: data.from,
        limit: tenantRow.maxHorizonDays + 1,
      });
      for (const d of days) daysWithSlot.add(d);
    }

    const sorted = Array.from(daysWithSlot).sort();
    return { days: sorted.slice(0, data.limit), hasMore: sorted.length > data.limit };
  });
}
