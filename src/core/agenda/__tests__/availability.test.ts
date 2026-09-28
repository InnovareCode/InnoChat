import { describe, expect, it } from "vitest";
import { computeAvailableSlots, computeDayWindows } from "../availability";
import type { WorkingHourRule } from "../types";

describe("computeDayWindows — virada de dia (fuso cruza a data UTC)", () => {
  it("um expediente noturno em America/Sao_Paulo (UTC-3) produz uma janela na data UTC seguinte", () => {
    // 2026-09-29 é terça (weekday 2). 22:00-23:30 local (UTC-3) = 01:00-02:30 UTC do dia 30.
    const workingHours: WorkingHourRule[] = [{ weekday: 2, startTime: "22:00", endTime: "23:30" }];

    const windows = computeDayWindows("2026-09-29", "America/Sao_Paulo", workingHours, []);

    expect(windows).toHaveLength(1);
    expect(windows[0].start.toISOString()).toBe("2026-09-30T01:00:00.000Z");
    expect(windows[0].end.toISOString()).toBe("2026-09-30T02:30:00.000Z");
  });
});

describe("computeDayWindows — horário de verão / mudança de fuso", () => {
  it("respeita a troca de offset em America/New_York em torno do início do horário de verão", () => {
    // 2026-03-07 é sábado (weekday 6), ainda em EST (UTC-5): 01:00 local = 06:00 UTC.
    const beforeDst = computeDayWindows(
      "2026-03-07",
      "America/New_York",
      [{ weekday: 6, startTime: "01:00", endTime: "04:00" }],
      [],
    );
    expect(beforeDst[0].start.toISOString()).toBe("2026-03-07T06:00:00.000Z");

    // 2026-03-09 é segunda (weekday 1), já em EDT (UTC-4) — o relógio adiantou em 08/03:
    // 01:00 local = 05:00 UTC, uma hora "a menos" de diferença que antes da troca.
    const afterDst = computeDayWindows(
      "2026-03-09",
      "America/New_York",
      [{ weekday: 1, startTime: "01:00", endTime: "04:00" }],
      [],
    );
    expect(afterDst[0].start.toISOString()).toBe("2026-03-09T05:00:00.000Z");
  });
});

describe("computeAvailableSlots — bloqueio parcial no meio do expediente", () => {
  const workingHours: WorkingHourRule[] = [{ weekday: 3, startTime: "09:00", endTime: "18:00" }]; // 2026-09-30 é quarta.

  it("não oferece horários que caem dentro do bloqueio (ex.: intervalo de almoço)", () => {
    const closedRanges = [
      // 12:00-13:00 local = 15:00-16:00 UTC.
      { startsAt: new Date("2026-09-30T15:00:00.000Z"), endsAt: new Date("2026-09-30T16:00:00.000Z") },
    ];

    const slots = computeAvailableSlots({
      dateISO: "2026-09-30",
      timezone: "America/Sao_Paulo",
      workingHours,
      closedRanges,
      busy: [],
      serviceDurationMin: 60,
      slotGranularityMin: 30,
      minLeadTimeMin: 0,
      now: new Date("2026-09-30T00:00:00.000Z"),
    });

    const withinBlock = slots.some(
      (s) => s.getTime() >= new Date("2026-09-30T15:00:00.000Z").getTime() && s.getTime() < new Date("2026-09-30T16:00:00.000Z").getTime(),
    );
    expect(withinBlock).toBe(false);
    // Ainda há horários antes e depois do bloqueio.
    expect(slots.some((s) => s.getTime() < new Date("2026-09-30T15:00:00.000Z").getTime())).toBe(true);
    expect(slots.some((s) => s.getTime() >= new Date("2026-09-30T16:00:00.000Z").getTime())).toBe(true);
  });
});

describe("computeAvailableSlots — serviço que não cabe no fim do expediente", () => {
  it("exclui o candidato cujo término passaria do fim do expediente", () => {
    const workingHours: WorkingHourRule[] = [{ weekday: 3, startTime: "09:00", endTime: "18:00" }];

    const slots = computeAvailableSlots({
      dateISO: "2026-09-30",
      timezone: "America/Sao_Paulo",
      workingHours,
      closedRanges: [],
      busy: [],
      serviceDurationMin: 90,
      slotGranularityMin: 60,
      minLeadTimeMin: 0,
      now: new Date("2026-09-30T00:00:00.000Z"),
    });

    // Expediente 12:00Z-21:00Z. Candidato às 20:00Z + 90min = 21:30Z > 21:00Z → fora.
    const has20h = slots.some((s) => s.toISOString() === "2026-09-30T20:00:00.000Z");
    expect(has20h).toBe(false);

    // Candidato às 19:00Z + 90min = 20:30Z <= 21:00Z → cabe, e é o último.
    const last = slots[slots.length - 1];
    expect(last.toISOString()).toBe("2026-09-30T19:00:00.000Z");
  });
});

describe("computeAvailableSlots — profissional que não faz o serviço", () => {
  it("devolve lista vazia independentemente do expediente estar livre", () => {
    const workingHours: WorkingHourRule[] = [{ weekday: 3, startTime: "09:00", endTime: "18:00" }];

    const slots = computeAvailableSlots({
      dateISO: "2026-09-30",
      timezone: "America/Sao_Paulo",
      workingHours,
      closedRanges: [],
      busy: [],
      serviceDurationMin: 30,
      slotGranularityMin: 15,
      minLeadTimeMin: 0,
      now: new Date("2026-09-30T00:00:00.000Z"),
      professionalEligible: false,
    });

    expect(slots).toEqual([]);
  });
});
