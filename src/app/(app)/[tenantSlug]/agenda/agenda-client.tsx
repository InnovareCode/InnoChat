"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { CalendarClock, CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/lib/cn";
import {
  capitalizeFirst,
  formatDayNumber,
  formatLongDateLabel,
  formatShortWeekdayLabel,
  formatTimeLabel,
  formatWeekRangeLabel,
  friendlyTimezoneLabel,
} from "@/components/lib/format-date";
import { listAppointmentsAction } from "@/modules/agenda/appointment-actions";
import {
  NovoAgendamentoDialog,
  type AgendaProfessional,
  type AgendaService,
  type NovoAgendamentoPrefill,
} from "@/components/agenda/novo-agendamento-dialog";
import { DetalheAgendamentoDialog, type AppointmentDetail } from "@/components/agenda/detalhe-agendamento-dialog";
import type { ProfessionalRow } from "../profissionais/profissionais-client";
import type { ServiceRow } from "../servicos/servicos-client";

const SLOT_MIN = 30;
const DEFAULT_WINDOW_START_MIN = 7 * 60;
const DEFAULT_WINDOW_END_MIN = 20 * 60;
const ROW_HEIGHT_PX = 48;
const WEEK_ROW_HEIGHT_PX = 28;

type ApptStatus = AppointmentDetail["status"];

type ApptRaw = {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
  status: ApptStatus;
  professionalId: string;
  contact: { name: string | null; phoneE164: string | null };
  service: { name: string };
  professional: { name: string };
};

/** Cor por status — mesma leitura visual em bloco de agenda e em badge. */
const STATUS_BLOCK_CLASSES: Record<ApptStatus, string> = {
  SCHEDULED: "bg-primary/90 hover:bg-primary text-white",
  COMPLETED: "bg-success/90 hover:bg-success text-white",
  NO_SHOW: "bg-warning/90 hover:bg-warning text-white",
  CANCELED: "bg-text-secondary/50 text-white line-through",
};
const STATUS_BADGE_VARIANT: Record<ApptStatus, "primary" | "success" | "warning" | "danger"> = {
  SCHEDULED: "primary",
  COMPLETED: "success",
  NO_SHOW: "warning",
  CANCELED: "danger",
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function minutesToHHMM(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function startOfWeekISO(dateISO: string): string {
  const wd = weekdayOf(dateISO); // 0=domingo
  const diff = (wd + 6) % 7; // dias desde segunda
  return addDaysISO(dateISO, -diff);
}

/** Intervalos de expediente de um profissional num dia da semana (0=domingo), já ordenados. */
function workingHoursForWeekday(prof: ProfessionalRow, weekday: number): { startTime: string; endTime: string }[] {
  return prof.workingHours
    .filter((h) => h.weekday === weekday)
    .slice()
    .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

function workingHoursSummary(hours: { startTime: string; endTime: string }[]): string {
  if (hours.length === 0) return "Folga";
  return hours.map((h) => `${h.startTime}–${h.endTime}`).join(", ");
}

export function AgendaClient({
  tenantSlug,
  timezone,
  professionals,
  services,
}: {
  tenantSlug: string;
  timezone: string;
  professionals: ProfessionalRow[];
  services: ServiceRow[];
}) {
  const [view, setView] = useState<"day" | "week">("day");
  const [dateISO, setDateISO] = useState(() => formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"));
  const [appointments, setAppointments] = useState<ApptRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoOpen, setNovoOpen] = useState(false);
  const [novoPrefill, setNovoPrefill] = useState<NovoAgendamentoPrefill | undefined>(undefined);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [nowTick, setNowTick] = useState(() => new Date());
  const [weekProfessionalId, setWeekProfessionalId] = useState<string>("");

  const activeProfessionals = useMemo(() => professionals.filter((p) => p.active), [professionals]);
  const agendaServices: AgendaService[] = services;
  const agendaProfessionals: AgendaProfessional[] = professionals;

  const rangeFrom = view === "day" ? dateISO : startOfWeekISO(dateISO);
  const rangeDays = view === "day" ? 1 : 7;

  const load = useCallback(() => {
    setLoading(true);
    const from = fromZonedTime(`${rangeFrom}T00:00:00`, timezone);
    const to = fromZonedTime(`${addDaysISO(rangeFrom, rangeDays)}T00:00:00`, timezone);
    listAppointmentsAction(tenantSlug, { from: from.toISOString(), to: to.toISOString(), limit: 500 })
      .then((result) => {
        if (result.ok) {
          setAppointments(
            (result.data as ApptRaw[]).filter((a) => a.status !== "CANCELED"),
          );
        }
      })
      .finally(() => setLoading(false));
  }, [tenantSlug, timezone, rangeFrom, rangeDays]);

  useEffect(() => {
    const timeoutId = setTimeout(load, 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  function goToday() {
    setDateISO(formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"));
  }
  function goPrev() {
    setDateISO((d) => addDaysISO(d, view === "day" ? -1 : -7));
  }
  function goNext() {
    setDateISO((d) => addDaysISO(d, view === "day" ? 1 : 7));
  }

  function openNovoAt(professionalId: string | null, startsAt: string) {
    setNovoPrefill({ professionalId, startsAt });
    setNovoOpen(true);
  }
  function openNovoBlank(forDate?: string) {
    setNovoPrefill(forDate ? { date: forDate } : undefined);
    setNovoOpen(true);
  }
  function openDetail(a: ApptRaw) {
    setDetail({
      id: a.id,
      startsAt: new Date(a.startsAt).toISOString(),
      endsAt: new Date(a.endsAt).toISOString(),
      status: a.status,
      contact: a.contact,
      service: a.service,
      professional: a.professional,
    });
  }

  const todayISO = formatInTimeZone(nowTick, timezone, "yyyy-MM-dd");

  // Contadores do dia — só fazem sentido olhando o dia de hoje, então usamos
  // o carregamento atual quando ele já cobre hoje (dia == hoje, ou a semana
  // corrente inclui hoje); senão os contadores refletem o dia selecionado.
  const countsDateISO = view === "day" ? dateISO : todayISO;
  const isCountingToday = countsDateISO === todayISO;
  const countsSource =
    view === "day"
      ? appointments
      : appointments.filter((a) => formatInTimeZone(new Date(a.startsAt), timezone, "yyyy-MM-dd") === countsDateISO);
  const totalCount = view === "day" ? countsSource.length : countsSource.length;
  const upcomingCount = countsSource.filter(
    (a) => a.status === "SCHEDULED" && new Date(a.startsAt).getTime() > nowTick.getTime(),
  ).length;

  return (
    <div>
      <PageHeader
        title="Agenda"
        description={friendlyTimezoneLabel(timezone)}
        action={
          <Button onClick={() => openNovoBlank()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo agendamento
          </Button>
        }
      />

      {!loading ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-secondary">
            <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="font-semibold tabular-nums text-text">{totalCount}</span>
            {isCountingToday ? "agendamentos hoje" : "agendamentos no dia selecionado"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-secondary">
            <CalendarPlus className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="font-semibold tabular-nums text-text">{upcomingCount}</span>
            próximos
          </span>
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Período anterior" onClick={goPrev}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" aria-label="Próximo período" onClick={goNext}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <p className="ml-2 text-sm font-medium text-text">
            {view === "day"
              ? formatLongDateLabel(dateISO)
              : formatWeekRangeLabel(startOfWeekISO(dateISO), addDaysISO(startOfWeekISO(dateISO), 6))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "week" ? (
            <Select
              aria-label="Filtrar semana por profissional"
              value={weekProfessionalId}
              onChange={(e) => setWeekProfessionalId(e.target.value)}
              className="h-9 w-auto min-w-[10rem]"
            >
              <option value="">Todos os profissionais</option>
              {activeProfessionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          ) : null}
          <div className="flex gap-1 rounded-card border border-border p-1">
            <button
              type="button"
              onClick={() => setView("day")}
              className={cn(
                "rounded-card px-3 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none",
                view === "day" ? "bg-primary text-white" : "text-text-secondary hover:bg-bg",
              )}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setView("week")}
              className={cn(
                "rounded-card px-3 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none",
                view === "week" ? "bg-primary text-white" : "text-text-secondary hover:bg-bg",
              )}
            >
              Semana
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="p-12 text-center text-sm text-text-secondary">Carregando agenda…</Card>
      ) : view === "day" ? (
        <DayView
          dateISO={dateISO}
          timezone={timezone}
          professionals={activeProfessionals}
          appointments={appointments}
          now={nowTick}
          onSlotClick={openNovoAt}
          onApptClick={openDetail}
        />
      ) : (
        <WeekView
          weekStartISO={rangeFrom}
          timezone={timezone}
          professionals={activeProfessionals}
          appointments={appointments}
          professionalId={weekProfessionalId}
          now={nowTick}
          onDayClick={(d) => {
            setDateISO(d);
            setView("day");
          }}
          onApptClick={openDetail}
        />
      )}

      <NovoAgendamentoDialog
        tenantSlug={tenantSlug}
        services={agendaServices}
        professionals={agendaProfessionals}
        timezone={timezone}
        open={novoOpen}
        onOpenChange={setNovoOpen}
        prefill={novoPrefill}
        onCreated={() => load()}
      />
      <DetalheAgendamentoDialog
        tenantSlug={tenantSlug}
        appointment={detail}
        timezone={timezone}
        onOpenChange={(open) => !open && setDetail(null)}
        onUpdated={() => load()}
      />
    </div>
  );
}

function computeWindow(
  dateISO: string,
  professionals: ProfessionalRow[],
  appointments: ApptRaw[],
  timezone: string,
): { startMin: number; endMin: number } {
  const weekday = weekdayOf(dateISO);
  let startMin = DEFAULT_WINDOW_START_MIN;
  let endMin = DEFAULT_WINDOW_END_MIN;

  for (const p of professionals) {
    for (const h of p.workingHours) {
      if (h.weekday !== weekday) continue;
      startMin = Math.min(startMin, toMinutes(h.startTime));
      endMin = Math.max(endMin, toMinutes(h.endTime));
    }
  }
  for (const a of appointments) {
    const startLocal = formatInTimeZone(new Date(a.startsAt), timezone, "HH:mm");
    const endLocal = formatInTimeZone(new Date(a.endsAt), timezone, "HH:mm");
    startMin = Math.min(startMin, toMinutes(startLocal));
    endMin = Math.max(endMin, toMinutes(endLocal));
  }
  return { startMin, endMin };
}

/** Fundo hachurado sutil — sinaliza "fora do expediente" sem parecer um bloqueio visual pesado. */
const OUT_OF_HOURS_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--color-border) 0, var(--color-border) 1px, transparent 1px, transparent 7px)",
  backgroundColor: "var(--color-bg)",
};

function DayView({
  dateISO,
  timezone,
  professionals,
  appointments,
  now,
  onSlotClick,
  onApptClick,
}: {
  dateISO: string;
  timezone: string;
  professionals: ProfessionalRow[];
  appointments: ApptRaw[];
  now: Date;
  onSlotClick: (professionalId: string, startsAtISO: string) => void;
  onApptClick: (a: ApptRaw) => void;
}) {
  const { startMin, endMin } = useMemo(
    () => computeWindow(dateISO, professionals, appointments, timezone),
    [dateISO, professionals, appointments, timezone],
  );
  const totalSlots = Math.max(1, Math.ceil((endMin - startMin) / SLOT_MIN));
  const columnHeight = totalSlots * ROW_HEIGHT_PX;

  const isToday = formatInTimeZone(now, timezone, "yyyy-MM-dd") === dateISO;
  const nowMin = isToday ? toMinutes(formatInTimeZone(now, timezone, "HH:mm")) : null;
  const nowTopPx = nowMin !== null && nowMin >= startMin && nowMin <= endMin ? ((nowMin - startMin) / SLOT_MIN) * ROW_HEIGHT_PX : null;

  function slotToISO(minuteOffset: number): string {
    const totalMin = startMin + minuteOffset;
    const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
    const mm = String(totalMin % 60).padStart(2, "0");
    return fromZonedTime(`${dateISO}T${hh}:${mm}:00`, timezone).toISOString();
  }

  const byProfessional = (professionalId: string) => appointments.filter((a) => a.professionalId === professionalId);

  const weekday = weekdayOf(dateISO);
  function isWithinWorkingHours(prof: ProfessionalRow, minuteOffset: number): boolean {
    const min = startMin + minuteOffset;
    return prof.workingHours.some((h) => h.weekday === weekday && min >= toMinutes(h.startTime) && min < toMinutes(h.endTime));
  }

  return (
    <>
      {/* Desktop/tablet: colunas por profissional */}
      <Card className="hidden overflow-x-auto md:block">
        <div className="flex min-w-full">
          <div className="w-16 shrink-0 border-r border-border">
            <div className="h-14 border-b border-border" />
            {Array.from({ length: totalSlots }).map((_, i) => {
              const min = startMin + i * SLOT_MIN;
              const label = min % 60 === 0 ? `${String(Math.floor(min / 60)).padStart(2, "0")}:00` : "";
              return (
                <div
                  key={i}
                  style={{ height: ROW_HEIGHT_PX }}
                  className="border-b border-border px-2 text-right text-xs tabular-nums text-text-secondary"
                >
                  {label}
                </div>
              );
            })}
          </div>

          {professionals.map((prof) => {
            const todaysHours = workingHoursForWeekday(prof, weekday);
            const isOffToday = todaysHours.length === 0;
            return (
              <div key={prof.id} className="min-w-[13rem] flex-1 border-r border-border last:border-r-0">
                <div className="flex h-14 flex-col items-center justify-center border-b border-border px-2 text-center">
                  <p className="truncate text-sm font-medium text-text">{prof.name}</p>
                  <p className={cn("truncate text-[11px] tabular-nums", isOffToday ? "font-medium text-text-secondary" : "text-text-secondary")}>
                    {workingHoursSummary(todaysHours)}
                  </p>
                </div>
                <div className="relative" style={{ height: columnHeight }}>
                  {isOffToday ? (
                    <div
                      className="absolute inset-0 flex items-center justify-center text-xs text-text-secondary"
                      style={OUT_OF_HOURS_STYLE}
                      aria-label={`${prof.name} não atende neste dia`}
                    >
                      <span className="rounded-full border border-border bg-surface px-3 py-1">Folga</span>
                    </div>
                  ) : (
                    Array.from({ length: totalSlots }).map((_, i) => {
                      const withinHours = isWithinWorkingHours(prof, i * SLOT_MIN);
                      if (!withinHours) {
                        return (
                          <div
                            key={i}
                            style={{ top: i * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX, ...OUT_OF_HOURS_STYLE }}
                            className="absolute left-0 right-0 border-b border-border"
                            aria-hidden="true"
                          />
                        );
                      }
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => onSlotClick(prof.id, slotToISO(i * SLOT_MIN))}
                          style={{ top: i * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
                          className={cn(
                            "absolute left-0 right-0 border-b border-border transition-colors duration-150 hover:bg-bg motion-reduce:transition-none",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                          )}
                          aria-label={`Novo agendamento com ${prof.name} às ${minutesToHHMM(startMin + i * SLOT_MIN)}`}
                        />
                      );
                    })
                  )}

                  {byProfessional(prof.id).map((a) => {
                    const startLocalMin = toMinutes(formatInTimeZone(new Date(a.startsAt), timezone, "HH:mm"));
                    const endLocalMin = toMinutes(formatInTimeZone(new Date(a.endsAt), timezone, "HH:mm"));
                    const top = ((startLocalMin - startMin) / SLOT_MIN) * ROW_HEIGHT_PX;
                    const height = Math.max(((endLocalMin - startLocalMin) / SLOT_MIN) * ROW_HEIGHT_PX, ROW_HEIGHT_PX / 2);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onApptClick(a)}
                        style={{ top, height, left: 4, right: 4 }}
                        className={cn(
                          "absolute z-10 overflow-hidden rounded-card p-1.5 text-left text-xs shadow-card transition-transform duration-150 hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                          STATUS_BLOCK_CLASSES[a.status],
                        )}
                      >
                        <p className="truncate font-semibold tabular-nums">{formatTimeLabel(a.startsAt, timezone)}</p>
                        <p className="truncate font-medium">{a.service.name}</p>
                        <p className="truncate opacity-90">{a.contact.name ?? "Sem nome"}</p>
                      </button>
                    );
                  })}

                  {nowTopPx !== null ? (
                    <div className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-danger" style={{ top: nowTopPx }}>
                      <span className="absolute -left-1 -top-1.5 h-3 w-3 rounded-full bg-danger" />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Celular: lista por profissional */}
      <div className="flex flex-col gap-4 md:hidden">
        {professionals.map((prof) => {
          const items = byProfessional(prof.id).sort((a, b) => a.startsAt.toString().localeCompare(b.startsAt.toString()));
          const todaysHours = workingHoursForWeekday(prof, weekday);
          const isOffToday = todaysHours.length === 0;
          return (
            <Card key={prof.id}>
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <p className="font-display text-sm font-bold text-text">{prof.name}</p>
                  <p className="text-xs tabular-nums text-text-secondary">{workingHoursSummary(todaysHours)}</p>
                </div>
                {!isOffToday ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSlotClick(prof.id, slotToISO(Math.max(0, (nowMin ?? startMin) - startMin)))}
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Agendar
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-col divide-y divide-border">
                {isOffToday && items.length === 0 ? (
                  <p className="p-4 text-sm text-text-secondary">Folga — não atende neste dia.</p>
                ) : items.length === 0 ? (
                  <p className="p-4 text-sm text-text-secondary">Nenhum agendamento neste dia.</p>
                ) : (
                  items.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onApptClick(a)}
                      className="flex items-center justify-between gap-3 p-4 text-left transition-colors duration-150 hover:bg-bg motion-reduce:transition-none"
                    >
                      <div>
                        <p className="text-sm font-medium text-text">{a.service.name}</p>
                        <p className="text-xs text-text-secondary">{a.contact.name ?? "Sem nome"}</p>
                      </div>
                      <Badge variant={STATUS_BADGE_VARIANT[a.status]} className="tabular-nums">
                        {formatTimeLabel(a.startsAt, timezone)}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function computeWeekWindow(
  days: string[],
  professionals: ProfessionalRow[],
  appointments: ApptRaw[],
  timezone: string,
): { startMin: number; endMin: number } {
  let startMin = DEFAULT_WINDOW_START_MIN;
  let endMin = DEFAULT_WINDOW_END_MIN;
  for (const dateISO of days) {
    const window = computeWindow(dateISO, professionals, appointments, timezone);
    startMin = Math.min(startMin, window.startMin);
    endMin = Math.max(endMin, window.endMin);
  }
  return { startMin, endMin };
}

function WeekView({
  weekStartISO,
  timezone,
  professionals,
  appointments,
  professionalId,
  now,
  onDayClick,
  onApptClick,
}: {
  weekStartISO: string;
  timezone: string;
  professionals: ProfessionalRow[];
  appointments: ApptRaw[];
  professionalId: string;
  now: Date;
  onDayClick: (dateISO: string) => void;
  onApptClick: (a: ApptRaw) => void;
}) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i)), [weekStartISO]);

  const filteredProfessionals = professionalId ? professionals.filter((p) => p.id === professionalId) : professionals;
  const filteredAppointments = professionalId
    ? appointments.filter((a) => a.professionalId === professionalId)
    : appointments;

  const { startMin, endMin } = useMemo(
    () => computeWeekWindow(days, filteredProfessionals, filteredAppointments, timezone),
    [days, filteredProfessionals, filteredAppointments, timezone],
  );
  const totalSlots = Math.max(1, Math.ceil((endMin - startMin) / SLOT_MIN));
  const columnHeight = totalSlots * WEEK_ROW_HEIGHT_PX;
  const todayISO = formatInTimeZone(now, timezone, "yyyy-MM-dd");

  function isWithinAnyWorkingHours(dateISO: string, minuteOffset: number): boolean {
    const weekday = weekdayOf(dateISO);
    const min = startMin + minuteOffset;
    return filteredProfessionals.some((p) =>
      p.workingHours.some((h) => h.weekday === weekday && min >= toMinutes(h.startTime) && min < toMinutes(h.endTime)),
    );
  }

  function apptsForDay(dateISO: string) {
    return filteredAppointments
      .filter((a) => formatInTimeZone(new Date(a.startsAt), timezone, "yyyy-MM-dd") === dateISO)
      .sort((a, b) => a.startsAt.toString().localeCompare(b.startsAt.toString()));
  }

  return (
    <>
      {/* Desktop/tablet: grade por horário, 7 colunas (dias) */}
      <Card className="hidden overflow-x-auto md:block">
        <div className="flex min-w-full">
          <div className="w-14 shrink-0 border-r border-border">
            <div className="h-14 border-b border-border" />
            {Array.from({ length: totalSlots }).map((_, i) => {
              const min = startMin + i * SLOT_MIN;
              const label = min % 60 === 0 ? `${String(Math.floor(min / 60)).padStart(2, "0")}:00` : "";
              return (
                <div
                  key={i}
                  style={{ height: WEEK_ROW_HEIGHT_PX }}
                  className="border-b border-border px-2 text-right text-[11px] tabular-nums text-text-secondary"
                >
                  {label}
                </div>
              );
            })}
          </div>

          {days.map((dateISO) => {
            const isToday = dateISO === todayISO;
            const dayAppts = apptsForDay(dateISO);
            return (
              <div
                key={dateISO}
                className={cn("min-w-[8.5rem] flex-1 border-r border-border last:border-r-0", isToday && "bg-primary/5")}
              >
                <button
                  type="button"
                  onClick={() => onDayClick(dateISO)}
                  className={cn(
                    "flex h-14 w-full flex-col items-center justify-center border-b border-border text-center transition-colors duration-150 hover:bg-bg motion-reduce:transition-none",
                    isToday && "border-b-primary",
                  )}
                >
                  <p className="text-[11px] text-text-secondary">{formatShortWeekdayLabel(dateISO, { capitalize: true })}</p>
                  <p
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                      isToday ? "bg-primary text-white" : "text-text",
                    )}
                  >
                    {formatDayNumber(dateISO)}
                  </p>
                </button>
                <div className="relative" style={{ height: columnHeight }}>
                  {Array.from({ length: totalSlots }).map((_, i) => {
                    const withinHours = isWithinAnyWorkingHours(dateISO, i * SLOT_MIN);
                    return (
                      <div
                        key={i}
                        style={{
                          top: i * WEEK_ROW_HEIGHT_PX,
                          height: WEEK_ROW_HEIGHT_PX,
                          ...(withinHours ? {} : OUT_OF_HOURS_STYLE),
                        }}
                        className="absolute left-0 right-0 border-b border-border"
                        aria-hidden="true"
                      />
                    );
                  })}

                  {dayAppts.map((a) => {
                    const startLocalMin = toMinutes(formatInTimeZone(new Date(a.startsAt), timezone, "HH:mm"));
                    const endLocalMin = toMinutes(formatInTimeZone(new Date(a.endsAt), timezone, "HH:mm"));
                    const top = ((startLocalMin - startMin) / SLOT_MIN) * WEEK_ROW_HEIGHT_PX;
                    const height = Math.max(((endLocalMin - startLocalMin) / SLOT_MIN) * WEEK_ROW_HEIGHT_PX, WEEK_ROW_HEIGHT_PX);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onApptClick(a)}
                        style={{ top, height, left: 3, right: 3 }}
                        className={cn(
                          "absolute z-10 overflow-hidden rounded-[4px] px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-card transition-transform duration-150 hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                          STATUS_BLOCK_CLASSES[a.status],
                        )}
                        title={`${formatTimeLabel(a.startsAt, timezone)} · ${a.service.name} · ${a.professional.name}`}
                      >
                        <span className="tabular-nums font-semibold">{formatTimeLabel(a.startsAt, timezone)}</span>{" "}
                        <span className="truncate">{a.service.name}</span>
                        {!professionalId ? <span className="block truncate opacity-90">{a.professional.name}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Celular: lista agrupada por dia */}
      <div className="flex flex-col gap-3 md:hidden">
        {days.map((dateISO) => {
          const isToday = dateISO === todayISO;
          const dayAppts = apptsForDay(dateISO);
          return (
            <Card key={dateISO} className={cn(isToday && "ring-1 ring-primary")}>
              <button
                type="button"
                onClick={() => onDayClick(dateISO)}
                className="flex w-full items-center justify-between border-b border-border p-3 text-left transition-colors duration-150 hover:bg-bg motion-reduce:transition-none"
              >
                <p className="text-sm font-medium text-text">
                  {capitalizeFirst(formatShortWeekdayLabel(dateISO))}, {formatDayNumber(dateISO)}
                </p>
                {isToday ? <Badge variant="primary">Hoje</Badge> : null}
              </button>
              <div className="flex flex-col divide-y divide-border">
                {dayAppts.length === 0 ? (
                  <p className="p-3 text-sm text-text-secondary">Sem agendamentos</p>
                ) : (
                  dayAppts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onApptClick(a)}
                      className="flex items-center justify-between gap-3 p-3 text-left transition-colors duration-150 hover:bg-bg motion-reduce:transition-none"
                    >
                      <div>
                        <p className="text-sm font-medium text-text">{a.service.name}</p>
                        <p className="text-xs text-text-secondary">{a.professional.name}</p>
                      </div>
                      <Badge variant={STATUS_BADGE_VARIANT[a.status]} className="tabular-nums">
                        {formatTimeLabel(a.startsAt, timezone)}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
