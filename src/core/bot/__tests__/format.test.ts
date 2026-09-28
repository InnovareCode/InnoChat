import { describe, expect, it } from "vitest";
import { formatDayLabel, formatPriceLabel, formatServiceLabel, formatTimeLabel } from "../format";

describe("formatDayLabel", () => {
  it("dia da semana abreviado em pt-BR + dd/MM, no fuso do tenant", () => {
    // 2026-09-29 é uma terça-feira.
    const date = new Date("2026-09-29T12:00:00.000Z");
    expect(formatDayLabel(date, "UTC")).toBe("Ter 29/09");
  });
});

describe("formatTimeLabel", () => {
  it("HH:mm no fuso do tenant", () => {
    const date = new Date("2026-09-29T17:30:00.000Z");
    expect(formatTimeLabel(date, "UTC")).toBe("17:30");
    expect(formatTimeLabel(date, "America/Sao_Paulo")).toBe("14:30");
  });
});

describe("formatPriceLabel / formatServiceLabel", () => {
  it("nulo/undefined não mostra preço", () => {
    expect(formatPriceLabel(null)).toBeNull();
    expect(formatPriceLabel(undefined)).toBeNull();
    expect(formatServiceLabel("Corte", null)).toBe("Corte");
  });

  it("formata centavos como moeda BRL", () => {
    expect(formatPriceLabel(8000)).toBe("R$ 80,00");
    expect(formatServiceLabel("Corte feminino", 8000)).toBe("Corte feminino — R$ 80,00");
  });
});
