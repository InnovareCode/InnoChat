import { computeAvailableDays, computeAvailableSlots } from "@/core/agenda";
import { formatDayLabel, formatServiceLabel, formatTimeLabel } from "@/core/bot/format";
import { getPrisma } from "@/lib/db/prisma";
import { forTenant } from "@/lib/db/tenant-client";
import { DomainError } from "@/lib/errors";
import { loadProfessionalScheduleInputs } from "@/modules/agenda/availability-loader";
import { cancelAppointment, createAppointmentManual, rescheduleAppointment } from "@/modules/agenda/appointments";
import { notFound, type InternalApiContext } from "./internal-auth";

export type Option = { id: string; label: string };

/**
 * Catálogo e disponibilidade formatados para o bot (docs/arquitetura.md §6.4) — reaproveita
 * `src/core/agenda` e `src/modules/agenda/availability-loader.ts` (a mesma matemática de
 * horários usada pelo painel, Fase 2), só muda a FORMA da resposta: sempre `{ options: [...] }`
 * já numerável e com rótulo pronto no fuso/locale do tenant.
 */

export async function listCatalogServiceOptions(tenantId: string): Promise<{ options: (Option & { durationMin: number })[] }> {
  const services = await forTenant(tenantId).service.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return {
    options: services.map((s) => ({ id: s.id, label: formatServiceLabel(s.name, s.priceCents), durationMin: s.durationMin })),
  };
}

export async function listCatalogProfessionalOptions(
  tenantId: string,
  serviceId: string,
): Promise<{ options: Option[]; skip: boolean }> {
  const service = await forTenant(tenantId).service.findFirst({ where: { id: serviceId, active: true } });
  if (!service) notFound("Serviço não encontrado.");

  const tenant = await getPrisma().tenant.findUniqueOrThrow({ where: { id: tenantId } });

  const links = await getPrisma().professionalService.findMany({
    where: { serviceId, professional: { tenantId, active: true } },
    select: { professionalId: true },
  });
  const professionalIds = Array.from(new Set(links.map((l) => l.professionalId)));
  const professionals = await forTenant(tenantId).professional.findMany({
    where: { id: { in: professionalIds } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const skip = !tenant.askProfessional || professionals.length <= 1;
  if (skip) {
    const options: Option[] = professionals.length === 1
      ? [{ id: professionals[0].id, label: professionals[0].name }]
      : [{ id: "any", label: "Qualquer profissional" }];
    return { options, skip: true };
  }

  return {
    options: [
      { id: "any", label: "Qualquer profissional" },
      ...professionals.map((p) => ({ id: p.id, label: p.name })),
    ],
    skip: false,
  };
}

async function resolveEligibleProfessionalIds(tenantId: string, serviceId: string, professionalId: string | null): Promise<string[]> {
  if (professionalId) {
    const professional = await forTenant(tenantId).professional.findFirst({ where: { id: professionalId, active: true } });
    if (!professional) notFound("Profissional não encontrado.");
    return [professionalId];
  }
  const links = await getPrisma().professionalService.findMany({
    where: { serviceId, professional: { tenantId, active: true } },
    select: { professionalId: true },
  });
  return Array.from(new Set(links.map((l) => l.professionalId)));
}

export async function listAvailabilityDayOptions(
  tenantId: string,
  params: { serviceId: string; professionalId: string | null; from: string | null; limit: number },
): Promise<{ options: Option[]; hasMore: boolean; nextFrom: string | null }> {
  const service = await forTenant(tenantId).service.findFirst({ where: { id: params.serviceId, active: true } });
  if (!service) notFound("Serviço não encontrado.");

  const tenant = await getPrisma().tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const professionalIds = await resolveEligibleProfessionalIds(tenantId, params.serviceId, params.professionalId);
  if (professionalIds.length === 0) return { options: [], hasMore: false, nextFrom: null };

  const now = new Date();
  // `from` omitido = hoje no fuso do tenant (docs/contratos.md — "API interna do bot").
  const fromDateISO = params.from ?? formatDayIso(now, tenant.timezone);
  const horizonEnd = new Date(now.getTime() + (tenant.maxHorizonDays + 2) * 86_400_000);
  const loadRange = { from: new Date(now.getTime() - 86_400_000), to: horizonEnd };

  const daysWithSlot = new Set<string>();
  for (const professionalId of professionalIds) {
    const { workingHourRules, closedRanges, busy } = await loadProfessionalScheduleInputs(tenantId, professionalId, loadRange);
    const { days } = computeAvailableDays({
      timezone: tenant.timezone,
      workingHours: workingHourRules,
      closedRanges,
      busy,
      serviceDurationMin: service.durationMin,
      slotGranularityMin: tenant.slotGranularityMin,
      minLeadTimeMin: tenant.minLeadTimeMin,
      maxHorizonDays: tenant.maxHorizonDays,
      now,
      fromDateISO,
      limit: tenant.maxHorizonDays + 1,
    });
    for (const d of days) daysWithSlot.add(d);
  }

  const sorted = Array.from(daysWithSlot).sort();
  const page = sorted.slice(0, params.limit);
  const hasMore = sorted.length > params.limit;

  return {
    options: page.map((iso) => ({ id: iso, label: formatDayLabel(dateISOToUtcNoon(iso), tenant.timezone) })),
    hasMore,
    nextFrom: hasMore ? page[page.length - 1] : null,
  };
}

// Meio-dia UTC evita a virada de data ao formatar de volta num fuso com offset negativo grande.
function dateISOToUtcNoon(dateISO: string): Date {
  return new Date(`${dateISO}T12:00:00.000Z`);
}

export async function listAvailabilitySlotOptions(
  tenantId: string,
  params: { serviceId: string; professionalId: string | null; date: string; offset: number; limit: number },
): Promise<{ options: Option[]; hasMore: boolean }> {
  const service = await forTenant(tenantId).service.findFirst({ where: { id: params.serviceId, active: true } });
  if (!service) notFound("Serviço não encontrado.");

  const tenant = await getPrisma().tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const professionalIds = await resolveEligibleProfessionalIds(tenantId, params.serviceId, params.professionalId);

  const now = new Date();
  const dayRange = { from: new Date(`${params.date}T00:00:00.000Z`), to: new Date(`${params.date}T23:59:59.999Z`) };
  const loadRange = { from: new Date(dayRange.from.getTime() - 86_400_000), to: new Date(dayRange.to.getTime() + 86_400_000) };

  const allSlots = new Set<number>();
  for (const professionalId of professionalIds) {
    const { workingHourRules, closedRanges, busy } = await loadProfessionalScheduleInputs(tenantId, professionalId, loadRange);
    const slots = computeAvailableSlots({
      dateISO: params.date,
      timezone: tenant.timezone,
      workingHours: workingHourRules,
      closedRanges,
      busy,
      serviceDurationMin: service.durationMin,
      slotGranularityMin: tenant.slotGranularityMin,
      minLeadTimeMin: tenant.minLeadTimeMin,
      now,
    });
    for (const s of slots) allSlots.add(s.getTime());
  }

  const sorted = Array.from(allSlots).sort((a, b) => a - b);
  const page = sorted.slice(params.offset, params.offset + params.limit);
  const hasMore = sorted.length > params.offset + params.limit;

  return {
    options: page.map((t) => ({ id: new Date(t).toISOString(), label: formatTimeLabel(new Date(t), tenant.timezone) })),
    hasMore,
  };
}

/**
 * Alternativas para `409 SLOT_TAKEN` (docs/arquitetura.md §2 regra 3, §6.5): até 6 horários do
 * MESMO dia do profissional pedido (ou "qualquer profissional" apto), e se não houver nenhum,
 * procura nos próximos dias com vaga dentro do horizonte — nunca devolve vazio se existir
 * QUALQUER horário possível.
 */
async function findAlternatives(
  tenantId: string,
  params: { serviceId: string; professionalId: string | null; startsAt: Date },
): Promise<{ date: string; options: Option[] }> {
  const tenant = await getPrisma().tenant.findUniqueOrThrow({ where: { id: tenantId } });

  const startDateISO = formatDayIso(params.startsAt, tenant.timezone);
  let cursor = startDateISO;
  const horizonLastISO = formatDayIso(new Date(Date.now() + tenant.maxHorizonDays * 86_400_000), tenant.timezone);

  for (let i = 0; i < tenant.maxHorizonDays + 1 && cursor <= horizonLastISO; i++) {
    const { options } = await listAvailabilitySlotOptions(tenantId, {
      serviceId: params.serviceId,
      professionalId: params.professionalId,
      date: cursor,
      offset: 0,
      limit: 6,
    });
    if (options.length > 0) {
      return { date: formatDayLabel(dateISOToUtcNoon(cursor), tenant.timezone), options };
    }
    cursor = formatDayIso(new Date(dateISOToUtcNoon(cursor).getTime() + 86_400_000), "UTC");
  }

  return { date: formatDayLabel(params.startsAt, tenant.timezone), options: [] };
}

function formatDayIso(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type CreateAppointmentBotInput = {
  contactId: string;
  serviceId: string;
  professionalId: string | null;
  startsAt: Date;
  idempotencyKey: string;
  instanceName?: string;
};

/** Formata `{ id, summary }` (docs/arquitetura.md §6.5) a partir de um `Appointment` recém-criado/existente. */
export async function toAppointmentSummary(tenantId: string, appointmentId: string) {
  const tenant = await getPrisma().tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const appointment = await forTenant(tenantId).appointment.findFirstOrThrow({
    where: { id: appointmentId },
    include: { service: true, professional: true },
  });
  return {
    id: appointment.id,
    summary: {
      servico: appointment.service.name,
      profissional: appointment.professional.name,
      data: formatDayLabel(appointment.startsAt, tenant.timezone),
      hora: formatTimeLabel(appointment.startsAt, tenant.timezone),
    },
  };
}

export async function createAppointmentBot(
  ctx: InternalApiContext,
  input: CreateAppointmentBotInput,
): Promise<{ appointment: Awaited<ReturnType<typeof toAppointmentSummary>>; alreadyExisted: boolean }> {
  if (input.instanceName && input.instanceName !== ctx.instance.instanceName) {
    throw new DomainError("INVALID_PAYLOAD", "instanceName não corresponde à instância autenticada.");
  }

  const contact = await forTenant(ctx.tenantId).contact.findFirst({ where: { id: input.contactId } });
  if (!contact) notFound("Cliente não encontrado.");

  try {
    const { appointment, alreadyExisted } = await createAppointmentManual(
      ctx.tenantId,
      {
        contactId: input.contactId,
        serviceId: input.serviceId,
        professionalId: input.professionalId,
        startsAt: input.startsAt,
        idempotencyKey: input.idempotencyKey,
      },
      contact!.id,
      { source: "WHATSAPP", whatsappInstanceId: ctx.instance.id, authorType: "CONTACT" },
    );
    const summary = await toAppointmentSummary(ctx.tenantId, (appointment as { id: string }).id);
    return { appointment: summary, alreadyExisted };
  } catch (error) {
    if (error instanceof DomainError && error.code === "SLOT_TAKEN") {
      const alternatives = await findAlternatives(ctx.tenantId, {
        serviceId: input.serviceId,
        professionalId: input.professionalId,
        startsAt: input.startsAt,
      });
      throw new DomainError("SLOT_TAKEN", "Este horário já está ocupado.", { alternatives });
    }
    throw error;
  }
}

async function loadOwnedContactAppointment(tenantId: string, appointmentId: string, contactId: string) {
  const appointment = await forTenant(tenantId).appointment.findFirst({ where: { id: appointmentId } });
  if (!appointment || appointment.contactId !== contactId) {
    notFound("Agendamento não encontrado.");
  }
  return appointment!;
}

export async function cancelAppointmentBot(ctx: InternalApiContext, appointmentId: string, contactId: string) {
  await loadOwnedContactAppointment(ctx.tenantId, appointmentId, contactId);
  return cancelAppointment(ctx.tenantId, appointmentId, contactId, undefined, "CONTACT");
}

export async function rescheduleAppointmentBot(ctx: InternalApiContext, appointmentId: string, contactId: string, startsAt: Date) {
  const appointment = await loadOwnedContactAppointment(ctx.tenantId, appointmentId, contactId);
  try {
    return await rescheduleAppointment(ctx.tenantId, appointmentId, startsAt, contactId, "CONTACT");
  } catch (error) {
    if (error instanceof DomainError && error.code === "SLOT_TAKEN") {
      const alternatives = await findAlternatives(ctx.tenantId, {
        serviceId: appointment.serviceId,
        professionalId: appointment.professionalId,
        startsAt,
      });
      throw new DomainError("SLOT_TAKEN", "Este horário já está ocupado.", { alternatives });
    }
    throw error;
  }
}

export type AppointmentOption = Option & {
  serviceId: string;
  professionalId: string;
  servico: string;
  profissional: string;
  data: string;
  hora: string;
  startsAt: string;
};

/**
 * `GET /contacts/{contactId}/appointments` (docs/arquitetura.md §6.5). Cada opção já vem com os
 * dados que o n8n precisaria extrair do `label` por regex para remarcar/cancelar (docs/contratos.md
 * — "API interna do bot"): `serviceId`/`professionalId`/`servico`/`profissional`/`data`/`hora`
 * (formatados no fuso do tenant, mesmos formatos de `core/bot/format.ts`) e `startsAt` em ISO.
 * `label` continua igual, por compatibilidade com quem já lê só ele.
 */
export async function listMyAppointmentOptions(tenantId: string, contactId: string, upcoming: boolean): Promise<{ options: AppointmentOption[] }> {
  const contact = await forTenant(tenantId).contact.findFirst({ where: { id: contactId } });
  if (!contact) notFound("Cliente não encontrado.");

  const tenant = await getPrisma().tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const now = new Date();

  const appointments = await forTenant(tenantId).appointment.findMany({
    where: {
      contactId,
      status: "SCHEDULED",
      ...(upcoming ? { startsAt: { gte: now } } : {}),
    },
    include: { service: true, professional: true },
    orderBy: { startsAt: "asc" },
    take: 50,
  });

  return {
    options: appointments.map((a) => {
      const data = formatDayLabel(a.startsAt, tenant.timezone);
      const hora = formatTimeLabel(a.startsAt, tenant.timezone);
      return {
        id: a.id,
        label: `${data} ${hora} — ${a.service.name} (${a.professional.name})`,
        serviceId: a.serviceId,
        professionalId: a.professionalId,
        servico: a.service.name,
        profissional: a.professional.name,
        data,
        hora,
        startsAt: a.startsAt.toISOString(),
      };
    }),
  };
}
