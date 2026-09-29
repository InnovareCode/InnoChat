"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/components/lib/cn";
import { formatTimeLabel } from "@/components/lib/format-date";
import { AppointmentSourceBadge } from "@/components/agenda/appointment-status";
import { getUpcomingAppointmentsAction } from "@/modules/notifications/actions";
import { useOnAppointmentsChanged } from "./notification-center-provider";
import { formatCountdown, isImminent, minutesUntilStart } from "./notification-utils";
import type { UpcomingAppointmentItem } from "./types";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: UpcomingAppointmentItem[] };

/**
 * "Próximos atendimentos hoje" (Início): os próximos 5 do resto do dia, com contador ("em 25 min"),
 * cliente, serviço, profissional e origem. Quem começa em até 15 min ganha destaque. O contador
 * é recalculado no cliente a cada 30 s a partir de `startsAt` (não do `minutesUntil` do servidor,
 * que envelhece); a lista é relida a cada 60 s e quando entra agendamento novo.
 */
export function UpcomingTodayCard({ tenantSlug, timezone }: { tenantSlug: string; timezone: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(
    (silent: boolean) => {
      if (!silent) setState({ status: "loading" });
      getUpcomingAppointmentsAction({ tenantSlug })
        .then((result) => {
          if (result.ok) setState({ status: "ready", items: result.data.items });
          else setState((current) => (silent && current.status === "ready" ? current : { status: "error" }));
        })
        .catch(() => setState((current) => (silent && current.status === "ready" ? current : { status: "error" })));
    },
    [tenantSlug],
  );

  useEffect(() => {
    const first = setTimeout(() => load(false), 0);
    const refetch = setInterval(() => load(true), 60_000);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(refetch);
      clearInterval(tick);
    };
  }, [load]);

  useOnAppointmentsChanged(() => load(true));

  return (
    <Card className="rounded-hero" data-testid="upcoming-today-card">
      <CardHeader>
        <CardTitle>Próximos atendimentos hoje</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {state.status === "loading" ? (
          <div className="flex flex-col gap-3 p-4" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-2/3 rounded-card" />
                  <Skeleton className="mt-1.5 h-3 w-1/2 rounded-card" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : state.status === "error" ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-text-secondary">Não deu para carregar os atendimentos de hoje.</p>
            <button
              type="button"
              onClick={() => load(false)}
              className="inline-flex min-h-[44px] items-center rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg"
            >
              Tentar de novo
            </button>
          </div>
        ) : state.items.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={CalendarClock}
              title="Nenhum atendimento pelo resto do dia"
              description="Quando um cliente marcar (pelo WhatsApp ou pelo painel), o horário aparece aqui."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {state.items.map((appt) => {
              const minutes = minutesUntilStart(appt.startsAt, now);
              const imminent = isImminent(minutes);
              return (
                <li
                  key={appt.id}
                  data-imminent={imminent ? "true" : undefined}
                  className={cn(
                    "flex items-center gap-3 p-4 transition-colors duration-200 motion-reduce:transition-none",
                    imminent && "bg-primary/5 shadow-[inset_3px_0_0_0_var(--color-primary)]",
                  )}
                >
                  <Avatar id={appt.contactName} name={appt.contactName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{appt.contactName}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {appt.serviceName} · {appt.professionalName}
                    </p>
                    <AppointmentSourceBadge source={appt.source} className="mt-0.5" />
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        imminent ? "text-primary" : "text-text",
                      )}
                    >
                      {formatCountdown(minutes)}
                    </p>
                    <p className="text-xs tabular-nums text-text-secondary">{formatTimeLabel(appt.startsAt, timezone)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
