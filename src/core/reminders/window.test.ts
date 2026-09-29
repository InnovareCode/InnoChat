import { describe, expect, it } from "vitest";
import { isInsideSendWindow, reminderFirstName, reminderStartsAtRange, whenLabel } from "./window";

const TZ = "America/Sao_Paulo"; // UTC-3

describe("isInsideSendWindow", () => {
  it("08:00 local entra; 07:59 e 21:00 ficam de fora", () => {
    expect(isInsideSendWindow(new Date("2026-10-01T11:00:00Z"), TZ)).toBe(true); // 08:00
    expect(isInsideSendWindow(new Date("2026-10-01T10:59:00Z"), TZ)).toBe(false); // 07:59
    expect(isInsideSendWindow(new Date("2026-10-02T00:00:00Z"), TZ)).toBe(false); // 21:00
    expect(isInsideSendWindow(new Date("2026-10-01T23:59:00Z"), TZ)).toBe(true); // 20:59
  });
});

describe("reminderStartsAtRange", () => {
  it("(now+2h, now+hoursBefore]", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    const r = reminderStartsAtRange(now, 24);
    expect(r.gt.toISOString()).toBe("2026-10-01T14:00:00.000Z");
    expect(r.lte.toISOString()).toBe("2026-10-02T12:00:00.000Z");
  });
});

describe("whenLabel", () => {
  const now = new Date("2026-10-01T15:00:00Z"); // 12:00 local, quinta 01/10
  it("hoje / amanhã / dia da semana + data (pelo calendário local)", () => {
    expect(whenLabel(new Date("2026-10-01T20:00:00Z"), now, TZ)).toBe("hoje");
    expect(whenLabel(new Date("2026-10-02T13:00:00Z"), now, TZ)).toBe("amanhã");
    expect(whenLabel(new Date("2026-10-03T13:00:00Z"), now, TZ)).toBe("sábado, 03/10");
  });
  it("22h local de hoje (01h UTC de amanhã) ainda é 'hoje'", () => {
    expect(whenLabel(new Date("2026-10-02T01:00:00Z"), now, TZ)).toBe("hoje");
  });
});

describe("reminderFirstName", () => {
  it("usa name, depois pushName, depois 'cliente'", () => {
    expect(reminderFirstName("Maria Souza", "M")).toBe("Maria");
    expect(reminderFirstName(null, "Joana Lima")).toBe("Joana");
    expect(reminderFirstName("  ", null)).toBe("cliente");
  });
});
