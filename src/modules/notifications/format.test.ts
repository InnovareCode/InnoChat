import { describe, expect, it } from "vitest";
import { appointmentBody, eventSource, eventTitle, formatWhen, minutesUntil, timelineLabel } from "./format";

describe("notifications/format", () => {
  it("título diz a origem", () => {
    expect(eventTitle("CREATED", "WHATSAPP")).toBe("Novo agendamento pelo WhatsApp");
    expect(eventTitle("CREATED", "PANEL")).toBe("Novo agendamento pelo painel");
    expect(eventTitle("CANCELED", "SYSTEM")).toBe("Agendamento cancelado");
    expect(eventTitle("NO_SHOW", "PANEL")).toBe("Cliente não compareceu");
  });

  it("origem: criação vale a do agendamento; demais, quem agiu", () => {
    expect(eventSource("CREATED", "USER", "WHATSAPP")).toBe("WHATSAPP");
    expect(eventSource("CANCELED", "CONTACT", "PANEL")).toBe("WHATSAPP");
    expect(eventSource("RESCHEDULED", "USER", "WHATSAPP")).toBe("PANEL");
    expect(eventSource("CANCELED", "SYSTEM", "PANEL")).toBe("SYSTEM");
  });

  it("corpo e data no fuso da empresa, em pt-BR", () => {
    // 2026-10-01T17:00Z = qui 14:00 em São Paulo (UTC-3)
    const startsAt = new Date("2026-10-01T17:00:00Z");
    expect(formatWhen(startsAt, "America/Sao_Paulo")).toBe("qui 01/10 às 14:00");
    expect(appointmentBody({ contactName: "Maria", serviceName: "Corte", professionalName: "Ana", startsAt, timezone: "America/Sao_Paulo" })).toBe(
      "Maria • Corte • com Ana • qui 01/10 às 14:00",
    );
  });

  it("rótulo da linha do tempo e minutos restantes", () => {
    expect(timelineLabel("CREATED", "CONTACT")).toBe("Cliente agendou pelo WhatsApp");
    expect(timelineLabel("CANCELED", "USER")).toBe("Cancelado pelo painel");
    const now = new Date("2026-10-01T10:00:00Z");
    expect(minutesUntil(new Date("2026-10-01T10:30:10Z"), now)).toBe(31);
    expect(minutesUntil(new Date("2026-10-01T09:00:00Z"), now)).toBe(0);
  });
});
