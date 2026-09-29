import { describe, expect, it } from "vitest";
import { firstNameFromEmail, firstNameOf, greetingAt, greetingForHour } from "./greeting";

describe("greetingForHour", () => {
  it.each([
    [0, "Boa noite"],
    [4, "Boa noite"],
    [5, "Bom dia"],
    [11, "Bom dia"],
    [12, "Boa tarde"],
    [17, "Boa tarde"],
    [18, "Boa noite"],
    [23, "Boa noite"],
  ])("%ih → %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("greetingAt", () => {
  it("usa o fuso da empresa, não o do servidor", () => {
    const instant = new Date("2026-09-29T15:30:00Z"); // 12:30 em São Paulo, 15:30 UTC, 00:30 (30/09) em Tóquio
    expect(greetingAt(instant, "America/Sao_Paulo")).toBe("Boa tarde");
    expect(greetingAt(instant, "Asia/Tokyo")).toBe("Boa noite");
    expect(greetingAt(new Date("2026-09-29T12:00:00Z"), "America/Sao_Paulo")).toBe("Bom dia");
  });
});

describe("firstNameFromEmail", () => {
  it("capitaliza o primeiro trecho da parte local", () => {
    expect(firstNameFromEmail("maria.silva@x.com")).toBe("Maria");
    expect(firstNameFromEmail("JOAO_costa@x.com")).toBe("Joao");
    expect(firstNameFromEmail("dev@innochat.local")).toBe("Dev");
  });
  it("devolve null quando não parece um nome", () => {
    expect(firstNameFromEmail("a@x.com")).toBeNull();
    expect(firstNameFromEmail("123456@x.com")).toBeNull();
    expect(firstNameFromEmail("")).toBeNull();
    expect(firstNameFromEmail(null)).toBeNull();
  });
});

describe("firstNameOf", () => {
  it("pega a primeira palavra do nome", () => {
    expect(firstNameOf("Maria da Silva")).toBe("Maria");
    expect(firstNameOf("  joão  ")).toBe("joão");
  });
  it("vazio ou ausente vira null (cai no e-mail)", () => {
    expect(firstNameOf("")).toBeNull();
    expect(firstNameOf("   ")).toBeNull();
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf(undefined)).toBeNull();
  });
});
