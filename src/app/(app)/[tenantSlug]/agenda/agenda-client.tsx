"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/lib/cn";
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

type ApptRaw = {
  id: string;
  startsAt: string | Date;
  endsAt: string | Date;
  status: AppointmentDetail["status"];
  professionalId: string;
  contact: { name: string | null; phoneE164: string | null };
  service: { name: string };
  professional: { name: string };
};

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
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

function formatHeaderDate(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "UTC",
  });
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

  return (
    <div>
      <PageHeader
        title="Agenda"
        description={`Fuso horário: ${timezone}`}
        action={
          <Button onClick={() => openNovoBlank()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo agendamento
          </Button>
        }
      />

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
          <p className="ml-2 text-sm font-medium capitalize text-text">
            {view === "day" ? formatHeaderDate(dateISO) : `Semana de ${formatHeaderDate(startOfWeekISO(dateISO))}`}
          </p>
        </div>
        <div className="flex gap-1 rounded-card border border-border p-1">
          <button
            type="button"
            onClick={() => setView("day")}
            className={cn(
              "rounded-card px-3 py-1.5 text-sm",
              view === "day" ? "bg-primary text-white" : "text-text-secondary hover:bg-bg",
            )}
          >
            Dia
          </button>
          <button
            type="button"
            onClick={() => setView("week")}
            className={cn(
              "rounded-card px-3 py-1.5 text-sm",
              view === "week" ? "bg-primary text-white" : "text-text-secondary hover:bg-bg",
            )}
          >
            Semana
          </button>
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
          appointments={appointments}
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
        open={novoOpen}
        onOpenChange={setNovoOpen}
        prefill={novoPrefill}
        onCreated={() => load()}
      />
      <DetalheAgendamentoDialog
        tenantSlug={tenantSlug}
        appointment={detail}
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

const ROW_HEIGHT_PX = 48;

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
            <div className="h-10 border-b border-border" />
            {Array.from({ length: totalSlots }).map((_, i) => {
              const min = startMin + i * SLOT_MIN;
              const label = min % 60 === 0 ? `${String(Math.floor(min / 60)).padStart(2, "0")}:00` : "";
              return (
                <div key={i} style={{ height: ROW_HEIGHT_PX }} className="border-b border-border px-2 text-right text-xs text-text-secondary">
                  {label}
                </div>
              );
            })}
          </div>

          {professionals.map((prof) => (
            <div key={prof.id} className="min-w-[13rem] flex-1 border-r border-border last:border-r-0">
              <div className="flex h-10 items-center justify-center border-b border-border px-2 text-sm font-medium text-text">
                {prof.name}
              </div>
              <div className="relative" style={{ height: columnHeight }}>
                {Array.from({ length: totalSlots }).map((_, i) => {
                  const withinHours = isWithinWorkingHours(prof, i * SLOT_MIN);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onSlotClick(prof.id, slotToISO(i * SLOT_MIN))}
                      style={{ top: i * ROW_HEIGHT_PX, height: ROW_HEIGHT_PX }}
                      className={cn(
                        "absolute left-0 right-0 border-b border-border hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                        !withinHours && "bg-bg/70",
                      )}
                      aria-label={`Novo agendamento com ${prof.name}`}
                    />
                  );
                })}

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
                      className="absolute z-10 overflow-hidden rounded-card bg-primary/90 p-1.5 text-left text-xs text-white shadow-card hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
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
          ))}
        </div>
      </Card>

      {/* Celular: lista por profissional */}
      <div className="flex flex-col gap-4 md:hidden">
        {professionals.map((prof) => {
          const items = byProfessional(prof.id).sort((a, b) => a.startsAt.toString().localeCompare(b.startsAt.toString()));
          return (
            <Card key={prof.id}>
              <div className="flex items-center justify-between border-b border-border p-4">
                <p className="font-display text-sm font-bold text-text">{prof.name}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSlotClick(prof.id, slotToISO(Math.max(0, (nowMin ?? startMin) - startMin)))}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Agendar
                </Button>
              </div>
              <div className="flex flex-col divide-y divide-border">
                {items.length === 0 ? (
                  <p className="p-4 text-sm text-text-secondary">Nenhum agendamento neste dia.</p>
                ) : (
                  items.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onApptClick(a)}
                      className="flex items-center justify-between gap-3 p-4 text-left hover:bg-bg"
                    >
                      <div>
                        <p className="text-sm font-medium text-text">{a.service.name}</p>
                        <p className="text-xs text-text-secondary">{a.contact.name ?? "Sem nome"}</p>
                      </div>
                      <Badge variant="primary">
                        {formatInTimeZone(new Date(a.startsAt), timezone, "HH:mm")}
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

function WeekView({
  weekStartISO,
  appointments,
  onDayClick,
  onApptClick,
}: {
  weekStartISO: string;
  appointments: ApptRaw[];
  onDayClick: (dateISO: string) => void;
  onApptClick: (a: ApptRaw) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(weekStartISO, i));

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((dayISO) => {
        const dayAppts = appointments
          .filter((a) => new Date(a.startsAt).toISOString().slice(0, 10) === dayISO)
          .sort((a, b) => a.startsAt.toString().localeCompare(b.startsAt.toString()));
        return (
          <Card key={dayISO} className="flex flex-col">
            <button
              type="button"
              onClick={() => onDayClick(dayISO)}
              className="border-b border-border p-3 text-left hover:bg-bg"
            >
              <p className="text-xs capitalize text-text-secondary">
                {formatHeaderDate(dayISO).split(",")[0] ?? formatHeaderDate(dayISO)}
              </p>
              <p className="font-display text-sm font-bold text-text">{dayISO.slice(8, 10)}</p>
            </button>
            <div className="flex flex-1 flex-col gap-1.5 p-2">
              {dayAppts.length === 0 ? (
                <p className="p-2 text-xs text-text-secondary">Sem agendamentos</p>
              ) : (
                dayAppts.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onApptClick(a)}
                    className="rounded-card border border-border p-2 text-left text-xs hover:bg-bg"
                  >
                    <p className="font-medium text-text">{new Date(a.startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="truncate text-text-secondary">{a.service.name} · {a.professional.name}</p>
                  </button>
                ))
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
