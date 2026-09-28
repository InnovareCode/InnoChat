"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <PageHeader
        title="Agendamentos"
        description="Lista filtrável por período, profissional e status."
        action={
          <Button onClick={() => setNovoOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo agendamento
          </Button>
        }
      />

      <Card className="mb-4 p-4">
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
        <Card className="p-12 text-center text-sm text-text-secondary">Carregando agendamentos…</Card>
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
        <Card>
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
