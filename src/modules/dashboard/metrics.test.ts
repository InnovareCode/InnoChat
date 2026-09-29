import { describe, expect, it } from "vitest";
import {
  botSharePercent,
  buildDailySeries,
  countAppointmentsInNextDays,
  countAppointmentsOnDay,
  noShowRatePercent,
  type AppointmentMetricRow,
} from "./metrics";

const TZ = "America/Sao_Paulo";

function row(overrides: Partial<AppointmentMetricRow> = {}): AppointmentMetricRow {
  return {
    startsAt: "2026-09-28T12:00:00Z",
    status: "SCHEDULED",
    source: "WHATSAPP",
    ...overrides,
  };
}

describe("countAppointmentsOnDay", () => {
  it("conta só os do dia certo, ignorando cancelados", () => {
    const rows: AppointmentMetricRow[] = [
      row({ startsAt: "2026-09-28T12:00:00Z" }),
      row({ startsAt: "2026-09-28T20:00:00Z" }),
      row({ startsAt: "2026-09-28T23:59:00Z", status: "CANCELED" }),
      row({ startsAt: "2026-09-29T05:00:00Z" }),
    ];
    expect(countAppointmentsOnDay(rows, "2026-09-28", TZ)).toBe(2);
  });

  it("retorna 0 sem agendamentos", () => {
    expect(countAppointmentsOnDay([], "2026-09-28", TZ)).toBe(0);
  });
});

describe("countAppointmentsInNextDays", () => {
  it("conta os dias dentro da janela, excluindo o que já passou da janela", () => {
    const rows: AppointmentMetricRow[] = [
      row({ startsAt: "2026-09-28T12:00:00Z" }),
      row({ startsAt: "2026-10-03T12:00:00Z" }),
      row({ startsAt: "2026-10-06T12:00:00Z" }), // fora da janela de 7 dias
    ];
    expect(countAppointmentsInNextDays(rows, "2026-09-28", 7, TZ)).toBe(2);
  });
});

describe("noShowRatePercent", () => {
  it("calcula a proporção de faltas sobre concluído+faltou", () => {
    const rows: AppointmentMetricRow[] = [
      row({ status: "COMPLETED" }),
      row({ status: "COMPLETED" }),
      row({ status: "COMPLETED" }),
      row({ status: "NO_SHOW" }),
      row({ status: "SCHEDULED" }), // não entra no denominador
    ];
    expect(noShowRatePercent(rows)).toBe(25);
  });

  it("retorna 0 (nunca NaN) sem denominador", () => {
    expect(noShowRatePercent([row({ status: "SCHEDULED" })])).toBe(0);
    expect(noShowRatePercent([])).toBe(0);
  });
});

describe("botSharePercent", () => {
  it("calcula a fração vinda do WhatsApp, ignorando cancelados", () => {
    const rows: AppointmentMetricRow[] = [
      row({ source: "WHATSAPP" }),
      row({ source: "WHATSAPP" }),
      row({ source: "PANEL" }),
      row({ source: "WHATSAPP", status: "CANCELED" }),
    ];
    expect(botSharePercent(rows)).toBe(67);
  });

  it("retorna 0 sem agendamentos válidos", () => {
    expect(botSharePercent([])).toBe(0);
    expect(botSharePercent([row({ status: "CANCELED" })])).toBe(0);
  });
});

describe("buildDailySeries", () => {
  it("cobre todos os dias da janela, mesmo sem agendamento (count 0)", () => {
    const rows: AppointmentMetricRow[] = [row({ startsAt: "2026-09-28T12:00:00Z" })];
    const series = buildDailySeries(rows, "2026-09-28", 3, TZ);
    expect(series).toHaveLength(3);
    expect(series.map((p) => p.date)).toEqual(["2026-09-26", "2026-09-27", "2026-09-28"]);
    expect(series.find((p) => p.date === "2026-09-28")?.count).toBe(1);
    expect(series.find((p) => p.date === "2026-09-26")?.count).toBe(0);
  });

  it("ignora agendamentos cancelados na contagem", () => {
    const rows: AppointmentMetricRow[] = [row({ startsAt: "2026-09-28T12:00:00Z", status: "CANCELED" })];
    const series = buildDailySeries(rows, "2026-09-28", 1, TZ);
    expect(series[0].count).toBe(0);
  });
});
