// Tipos puros do motor de agenda (docs/arquitetura.md §5 "Cálculo de horários", §10 core/).
// Nada de Prisma/Next aqui — quem monta esses objetos a partir do banco é
// src/modules/agenda/*.

/** Regra de expediente semanal. `startTime`/`endTime` em hora LOCAL do tenant, "HH:mm". */
export type WorkingHourRule = {
  weekday: number; // 0 (domingo) .. 6 (sábado)
  startTime: string;
  endTime: string;
};

/** Bloqueio/feriado (empresa ou profissional) já resolvido como instante absoluto (UTC). */
export type ClosedRange = {
  startsAt: Date;
  endsAt: Date;
};

/** Agendamento existente que ocupa a agenda do profissional: `[startsAt, blockEndsAt)`. */
export type BusyRange = {
  startsAt: Date;
  blockEndsAt: Date;
};

/** Janela de tempo livre, como instante absoluto (UTC). */
export type TimeWindow = {
  start: Date;
  end: Date;
};

export type BookingRuleViolation = "OUTSIDE_HOURS" | "LEAD_TIME" | "HORIZON";
