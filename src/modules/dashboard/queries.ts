import { formatInTimeZone } from "date-fns-tz";
import { requireTenantMember } from "@/lib/auth/guards";
import { forTenant } from "@/lib/db/tenant-client";
import {
  botSharePercent,
  buildDailySeries,
  countAppointmentsInNextDays,
  countAppointmentsOnDay,
  noShowRatePercent,
  type AppointmentMetricRow,
} from "./metrics";

/**
 * Camada de leitura do "Início" (docs/design/premium-spec.md §10, exceção autorizada pelo Atlas
 * a este módulo de UI: só LEITURA, escopo por tenant via `forTenant`/`requireTenantMember`,
 * mesmo padrão que o resto do backend já usa). Nenhuma escrita, nenhuma regra de negócio nova —
 * o cálculo em si vive em `metrics.ts` (puro, testado sem banco).
 */

const WINDOW_DAYS = 30;

export type DashboardView = {
  timezone: string;
  appointmentsToday: number;
  appointmentsNext7Days: number;
  noShowRatePercent: number;
  botSharePercent: number;
  connectedWhatsappCount: number;
  totalWhatsappCount: number;
  dailySeries: { date: string; count: number }[];
  upcoming: {
    id: string;
    startsAt: string;
    serviceName: string;
    professionalName: string;
    contactName: string | null;
  }[];
};

export async function getDashboardView(tenantSlug: string): Promise<DashboardView> {
  const { tenant } = await requireTenantMember(tenantSlug);
  const db = forTenant(tenant.id);

  const now = new Date();
  const todayISO = formatInTimeZone(now, tenant.timezone, "yyyy-MM-dd");
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [windowRows, whatsappCounts, upcomingRows] = await Promise.all([
    db.appointment.findMany({
      where: { startsAt: { gte: windowStart } },
      select: { startsAt: true, status: true, source: true },
    }),
    db.whatsappInstance.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    db.appointment.findMany({
      where: { status: "SCHEDULED", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 6,
      select: {
        id: true,
        startsAt: true,
        service: { select: { name: true } },
        professional: { select: { name: true } },
        contact: { select: { name: true } },
      },
    }),
  ]);

  const metricRows: AppointmentMetricRow[] = windowRows.map((r) => ({
    startsAt: r.startsAt,
    status: r.status,
    source: r.source,
  }));

  const connectedWhatsappCount = whatsappCounts.find((c) => c.status === "CONNECTED")?._count._all ?? 0;
  const totalWhatsappCount = whatsappCounts.reduce((sum, c) => sum + c._count._all, 0);

  return {
    timezone: tenant.timezone,
    appointmentsToday: countAppointmentsOnDay(metricRows, todayISO, tenant.timezone),
    appointmentsNext7Days: countAppointmentsInNextDays(metricRows, todayISO, 7, tenant.timezone),
    noShowRatePercent: noShowRatePercent(metricRows),
    botSharePercent: botSharePercent(metricRows),
    connectedWhatsappCount,
    totalWhatsappCount,
    dailySeries: buildDailySeries(metricRows, todayISO, WINDOW_DAYS, tenant.timezone),
    upcoming: upcomingRows.map((r) => ({
      id: r.id,
      startsAt: r.startsAt.toISOString(),
      serviceName: r.service.name,
      professionalName: r.professional.name,
      contactName: r.contact.name,
    })),
  };
}
