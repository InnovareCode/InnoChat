import { forTenant } from "@/lib/db/tenant-client";
import type { BusyRange, ClosedRange, WorkingHourRule } from "@/core/agenda";

/**
 * Carrega, para UM profissional já validado como pertencente ao tenant (precondição — o
 * chamador precisa ter confirmado isso com `forTenant(tenantId).professional.findFirst`
 * antes de chamar esta função; ver a lição em `.claude/agent-memory/vega/for_tenant_scope_limits.md`),
 * os insumos que `src/core/agenda` precisa para calcular disponibilidade num intervalo de datas:
 * expediente semanal, bloqueios (empresa + profissional) e agendamentos já ocupando a agenda.
 *
 * `WorkingHour` não tem `tenantId` próprio — por isso o filtro é só por `professionalId`
 * (confiando na precondição acima). `ScheduleException` e `Appointment` TÊM `tenantId`
 * próprio, então `forTenant()` já os escopa automaticamente por conta própria.
 */
export async function loadProfessionalScheduleInputs(
  tenantId: string,
  professionalId: string,
  dateRange: { from: Date; to: Date },
  options?: { excludeAppointmentId?: string },
): Promise<{ workingHourRules: WorkingHourRule[]; closedRanges: ClosedRange[]; busy: BusyRange[] }> {
  const db = forTenant(tenantId);

  const [workingHours, companyExceptions, professionalExceptions, busyAppointments] = await Promise.all([
    db.workingHour.findMany({ where: { professionalId } }),
    db.scheduleException.findMany({
      where: { professionalId: null, startsAt: { lt: dateRange.to }, endsAt: { gt: dateRange.from } },
    }),
    db.scheduleException.findMany({
      where: { professionalId, startsAt: { lt: dateRange.to }, endsAt: { gt: dateRange.from } },
    }),
    db.appointment.findMany({
      where: {
        professionalId,
        status: "SCHEDULED",
        startsAt: { lt: dateRange.to },
        blockEndsAt: { gt: dateRange.from },
        ...(options?.excludeAppointmentId ? { id: { not: options.excludeAppointmentId } } : {}),
      },
      select: { id: true, startsAt: true, blockEndsAt: true },
    }),
  ]);

  return {
    workingHourRules: workingHours.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime })),
    closedRanges: [...companyExceptions, ...professionalExceptions].map((e) => ({ startsAt: e.startsAt, endsAt: e.endsAt })),
    busy: busyAppointments.map((a) => ({ startsAt: a.startsAt, blockEndsAt: a.blockEndsAt })),
  };
}
