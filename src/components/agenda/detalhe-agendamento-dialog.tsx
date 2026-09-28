"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cancelAppointmentAction, rescheduleAppointmentAction } from "@/modules/agenda/appointment-actions";
import { formatDateTimeLabel, formatTimeLabel } from "@/components/lib/format-date";

export type AppointmentDetail = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "SCHEDULED" | "CANCELED" | "COMPLETED" | "NO_SHOW";
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

type Props = {
  tenantSlug: string;
  appointment: AppointmentDetail | null;
  /** Fuso do tenant — sem isso as horas exibidas seriam as do navegador de quem está vendo, não as da empresa. */
  timezone: string;
  onOpenChange: (open: boolean) => void;
  onUpdated: (appointment: unknown) => void;
};

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DetalheAgendamentoDialog({ tenantSlug, appointment, timezone, onOpenChange, onUpdated }: Props) {
  const [mode, setMode] = useState<"view" | "reschedule" | "cancel">("view");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!appointment) return null;

  function close() {
    setMode("view");
    setError(null);
    onOpenChange(false);
  }

  function handleCancel() {
    if (!appointment) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelAppointmentAction(tenantSlug, appointment.id, { note: cancelNote.trim() || undefined });
      if (!result.ok) {
        setError(result.error.code === "TOO_LATE" ? "Prazo mínimo para cancelar já passou." : result.error.message);
        return;
      }
      onUpdated(result.data);
      close();
    });
  }

  function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;
    setError(null);
    if (!newStartsAt) {
      setError("Escolha o novo horário.");
      return;
    }
    startTransition(async () => {
      const result = await rescheduleAppointmentAction(tenantSlug, appointment.id, {
        startsAt: new Date(newStartsAt).toISOString(),
      });
      if (!result.ok) {
        if (result.error.code === "SLOT_TAKEN") {
          setError("Esse horário acabou de ser ocupado. Escolha outro.");
          return;
        }
        setError(result.error.code === "TOO_LATE" ? "Prazo mínimo para remarcar já passou." : result.error.message);
        return;
      }
      onUpdated(result.data);
      close();
    });
  }

  return (
    <Dialog open={!!appointment} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogTitle>Agendamento</DialogTitle>
        <DialogDescription>
          {appointment.service.name} com {appointment.professional.name}
        </DialogDescription>

        <div className="mt-4 flex flex-col gap-3">
          {error ? <Alert variant="danger">{error}</Alert> : null}

          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">Status</p>
            <Badge variant={STATUS_VARIANT[appointment.status]}>{STATUS_LABEL[appointment.status]}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">Cliente</p>
            <p className="text-sm text-text">{appointment.contact.name ?? "Sem nome"}</p>
          </div>
          {appointment.contact.phoneE164 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-secondary">Telefone</p>
              <p className="text-sm text-text">{appointment.contact.phoneE164}</p>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">Horário</p>
            <p className="text-sm tabular-nums text-text">
              {formatDateTimeLabel(appointment.startsAt, timezone)} – {formatTimeLabel(appointment.endsAt, timezone)}
            </p>
          </div>

          {mode === "reschedule" ? (
            <form onSubmit={handleReschedule} className="flex flex-col gap-3 border-t border-border pt-3">
              <Label htmlFor="reschedule-input">Novo horário</Label>
              <Input
                id="reschedule-input"
                type="datetime-local"
                value={newStartsAt}
                onChange={(e) => setNewStartsAt(e.target.value)}
                required
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setMode("view")}>
                  Voltar
                </Button>
                <Button type="submit" isLoading={isPending}>
                  Confirmar remarcação
                </Button>
              </div>
            </form>
          ) : null}

          {mode === "cancel" ? (
            <div className="flex flex-col gap-3 border-t border-border pt-3">
              <Label htmlFor="cancel-note">Motivo do cancelamento (opcional)</Label>
              <Input id="cancel-note" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
              <p className="text-sm text-text-secondary">Tem certeza que quer cancelar este agendamento?</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setMode("view")}>
                  Voltar
                </Button>
                <Button type="button" variant="danger" onClick={handleCancel} isLoading={isPending}>
                  Confirmar cancelamento
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {mode === "view" && appointment.status === "SCHEDULED" ? (
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setNewStartsAt(toDateTimeLocal(appointment.startsAt));
                setMode("reschedule");
              }}
            >
              Remarcar
            </Button>
            <Button type="button" variant="danger" onClick={() => setMode("cancel")}>
              Cancelar agendamento
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
