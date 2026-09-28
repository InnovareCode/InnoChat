import { describe, expect, it } from "vitest";
import { BOT_TEXT_KEYS, DEFAULT_BOT_TEXTS, findUnknownVariables, renderTemplate } from "../texts";

describe("renderTemplate", () => {
  it("substitui variáveis conhecidas", () => {
    expect(renderTemplate("Olá, {nome}!", { nome: "Maria" })).toBe("Olá, Maria!");
  });

  it("deixa a variável como está quando não há valor correspondente (nunca lança)", () => {
    expect(renderTemplate("Olá, {nome}!", {})).toBe("Olá, {nome}!");
  });

  it("aceita number/null/undefined nos valores", () => {
    expect(renderTemplate("{preco}", { preco: null })).toBe("{preco}");
    expect(renderTemplate("{preco}", { preco: 80 })).toBe("80");
  });
});

describe("findUnknownVariables", () => {
  it("nenhuma variável desconhecida num texto só com variáveis válidas", () => {
    expect(findUnknownVariables("{nome} da {empresa}, {servico} com {profissional} em {data} às {hora} por {preco}")).toEqual([]);
  });

  it("aponta variáveis fora da lista conhecida", () => {
    expect(findUnknownVariables("Olá {nome}, seu {codigoSecreto} é {outraCoisa}")).toEqual(["codigoSecreto", "outraCoisa"]);
  });
});

describe("DEFAULT_BOT_TEXTS", () => {
  it("tem uma entrada para toda chave de BOT_TEXT_KEYS, e nenhuma variável desconhecida nos padrões", () => {
    for (const key of BOT_TEXT_KEYS) {
      const text = DEFAULT_BOT_TEXTS[key];
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
      expect(findUnknownVariables(text)).toEqual([]);
    }
  });
});
