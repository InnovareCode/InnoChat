"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { navIconFor } from "@/components/shell/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "@/components/ui/table";
import { listAppointmentsAction } from "@/modules/agenda/appointment-actions";
import { formatDateTimeShortLabel } from "@/components/lib/format-date";
import { NovoAgendamentoDialog, type AgendaProfessional, type AgendaService } from "@/components/agenda/novo-agendamento-dialog";
import { DetalheAgendamentoDialog, type AppointmentDetail } from "@/components/agenda/detalhe-agendamento-dialog";
import type { ProfessionalRow } from "../profissionais/profissionais-client";
import type { ServiceRow } from "../servicos/servicos-client";

type ApptRaw = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentDetail["status"];
  professionalId: string;
  contact: { name: string | null; phoneE164: string | null };
  service: { name: string };
  professional: { name: string };
};

const STATUS_LABEL: Record<AppointmentDetail["status"], string> = {
  SCHEDULED: "Agendado",
  CANCELED: "Cancelado",
  COMPLETED: "Concluído",
  NO_SHOW: "Não veio",
};

const STATUS_VARIANT: Record<AppointmentDetail["status"], "success" | "danger" | "neutral" | "warning"> = {
  SCHEDULED: "success",
  CANCELED: "danger",
  COMPLETED: "neutral",
  NO_SHOW: "warning",
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AgendamentosClient({
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
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(addDaysISO(todayISO(), 14));
  const [professionalId, setProfessionalId] = useState("");
  const [status, setStatus] = useState<"ALL" | AppointmentDetail["status"]>("ALL");
  const [appointments, setAppointments] = useState<ApptRaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAppointmentsAction(tenantSlug, {
      from: new Date(`${from}T00:00:00`).toISOString(),
      to: new Date(`${to}T23:59:59`).toISOString(),
      professionalId: professionalId || undefined,
      limit: 500,
    }).then((result) => {
      if (!result.ok) {
        setError(result.error.message);
        setAppointments([]);
      } else {
        setAppointments(result.data as ApptRaw[]);
      }
      setLoading(false);
    });
  }, [tenantSlug, from, to, professionalId]);

  useEffect(() => {
    const timeoutId = setTimeout(load, 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  const filtered = appointments.filter((a) => status === "ALL" || a.status === status);

  function openDetail(a: ApptRaw) {
    setDetail(a);
  }

  return (
    <div>
      <PageHeader icon={navIconFor("agendamentos")}
        title="Agendamentos"
        description="Lista filtrável por período, profissional e status."
        action={
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo agendamento
          </Button>
        }
      />

      {!loading && !error ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-text-secondary ring-1 ring-primary/15">
            <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            <span className="font-semibold tabular-nums text-text">{filtered.length}</span>
            no período filtrado
          </span>
        </div>
      ) : null}

      <Card className="mb-4 rounded-hero p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="filtro-de">De</Label>
            <Input id="filtro-de" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="filtro-ate">Até</Label>
            <Input id="filtro-ate" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="filtro-prof">Profissional</Label>
            <Select id="filtro-prof" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Todos</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="filtro-status">Status</Label>
            <Select id="filtro-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="ALL">Todos</option>
              <option value="SCHEDULED">Agendado</option>
              <option value="CANCELED">Cancelado</option>
              <option value="COMPLETED">Concluído</option>
              <option value="NO_SHOW">Não veio</option>
            </Select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-hero" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={ClipboardList} title="Não deu para carregar" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum agendamento neste período"
          description="Ajuste os filtros ou crie um novo agendamento."
          action={<Button onClick={() => setNovoOpen(true)}>Novo agendamento</Button>}
        />
      ) : (
        <>
          <Card className="hidden rounded-hero md:block">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Data/hora</TableHeadCell>
                  <TableHeadCell>Cliente</TableHeadCell>
                  <TableHeadCell>Serviço</TableHeadCell>
                  <TableHeadCell>Profissional</TableHeadCell>
                  <TableHeadCell>Status</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => openDetail(a)}>
                    <TableCell className="tabular-nums">{formatDateTimeShortLabel(a.startsAt, timezone)}</TableCell>
                    <TableCell>{a.contact.name ?? "Sem nome"}</TableCell>
                    <TableCell>{a.service.name}</TableCell>
                    <TableCell>{a.professional.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((a) => (
              <Card
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(a)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDetail(a);
                  }
                }}
                className="cursor-pointer rounded-hero p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-text">{a.contact.name ?? "Sem nome"}</p>
                  <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{a.service.name} · {a.professional.name}</p>
                <p className="mt-2 text-xs tabular-nums text-text-secondary">
                  {formatDateTimeShortLabel(a.startsAt, timezone)}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}

      <NovoAgendamentoDialog
        tenantSlug={tenantSlug}
        services={services as AgendaService[]}
        professionals={professionals as AgendaProfessional[]}
        timezone={timezone}
        open={novoOpen}
        onOpenChange={setNovoOpen}
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
