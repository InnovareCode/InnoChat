"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CalendarPlus, CalendarX, CheckCircle2, Circle, RotateCcw, UserX, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/lib/cn";
import { formatDateTimeShortLabel } from "@/components/lib/format-date";
import { getAppointmentTimelineAction } from "@/modules/notifications/actions";

type TimelineItem = {
  id: string;
  action: string;
  authorType: string;
  authorLabel: string;
  note: string | null;
  createdAt: string;
  label: string;
};

const ACTION_VISUAL: Record<string, { icon: LucideIcon; tone: string }> = {
  CREATED: { icon: CalendarPlus, tone: "bg-primary/10 text-primary" },
  RESCHEDULED: { icon: CalendarClock, tone: "bg-warning-bg text-warning" },
  CANCELED: { icon: CalendarX, tone: "bg-danger-bg text-danger" },
  COMPLETED: { icon: CheckCircle2, tone: "bg-success-bg text-success" },
  NO_SHOW: { icon: UserX, tone: "bg-warning-bg text-warning" },
  REOPENED: { icon: RotateCcw, tone: "bg-primary/10 text-primary" },
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; items: TimelineItem[] };

/**
 * Histórico do agendamento (criado pelo WhatsApp, remarcado, cancelado pelo cliente…), do mais
 * antigo ao mais novo. O texto principal (`label`) vem pronto do servidor — a UI só escolhe o
 * ícone pela `action` e mostra quem fez (`authorLabel`) e a observação, se houver.
 * `refreshKey` refaz a leitura depois de uma ação (ex.: remarcar) sem desmontar o componente.
 */
export function AppointmentTimeline({
  tenantSlug,
  appointmentId,
  timezone,
  refreshKey = 0,
}: {
  tenantSlug: string;
  appointmentId: string;
  timezone: string;
  refreshKey?: number;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    // setTimeout(0): o lint `react-hooks/set-state-in-effect` bloqueia setState síncrono no efeito.
    const timeoutId = setTimeout(() => {
      setState({ status: "loading" });
      getAppointmentTimelineAction({ tenantSlug, appointmentId })
        .then((result) => {
          if (!active) return;
          if (!result.ok) {
            setState({ status: "error", message: result.error.message });
            return;
          }
          setState({ status: "ready", items: result.data.items });
        })
        .catch(() => {
          if (active) setState({ status: "error", message: "Não foi possível carregar o histórico agora." });
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [tenantSlug, appointmentId, refreshKey]);

  return (
    <section aria-labelledby={`timeline-${appointmentId}`} className="border-t border-border pt-4">
      <h3 id={`timeline-${appointmentId}`} className="mb-3 font-display text-sm font-bold text-text">
        Histórico
      </h3>

      {state.status === "loading" ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-3/4 rounded-card" />
                <Skeleton className="mt-1.5 h-3 w-1/3 rounded-card" />
              </div>
            </div>
          ))}
        </div>
      ) : state.status === "error" ? (
        <p className="text-sm text-text-secondary">{state.message}</p>
      ) : state.items.length === 0 ? (
        <p className="text-sm text-text-secondary">Sem registros de histórico para este agendamento.</p>
      ) : (
        <ol className="flex flex-col">
          {state.items.map((item, index) => {
            const visual = ACTION_VISUAL[item.action] ?? { icon: Circle, tone: "bg-bg text-text-secondary" };
            const Icon = visual.icon;
            const isLast = index === state.items.length - 1;
            return (
              <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                {!isLast ? <span className="absolute left-4 top-8 h-[calc(100%-2rem)] w-px bg-border" aria-hidden="true" /> : null}
                <span className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full", visual.tone)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium text-text">{item.label}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    <span className="tabular-nums">{formatDateTimeShortLabel(item.createdAt, timezone)}</span>
                    {item.authorLabel ? ` · ${item.authorLabel}` : ""}
                  </p>
                  {item.note ? <p className="mt-1 break-words text-xs text-text-secondary">“{item.note}”</p> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
