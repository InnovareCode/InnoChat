import { describe, expect, it } from "vitest";
import { parseSender, toMailFrom } from "../sender";

describe("parseSender", () => {
  it("aceita só o e-mail", () => {
    expect(parseSender("no-reply@innovarecode.com.br")).toEqual({ name: null, email: "no-reply@innovarecode.com.br" });
  });
  it("aceita nome + e-mail, com ou sem aspas", () => {
    expect(parseSender("InnoChat <no-reply@innovarecode.com.br>")).toEqual({ name: "InnoChat", email: "no-reply@innovarecode.com.br" });
    expect(parseSender('"InnoChat Suporte" <a@b.com>')).toEqual({ name: "InnoChat Suporte", email: "a@b.com" });
  });
  it("recusa formatos inválidos", () => {
    expect(parseSender("")).toBeNull();
    expect(parseSender("InnoChat")).toBeNull();
    expect(parseSender("InnoChat <sem-arroba>")).toBeNull();
    expect(parseSender("a@b.com <c@d.com> extra")).toBeNull();
  });
});

describe("toMailFrom", () => {
  it("e-mail cru sai com o nome InnoChat (não 'no-reply' na caixa de entrada)", () => {
    expect(toMailFrom("no-reply@innovarecode.com.br")).toEqual({ name: "InnoChat", address: "no-reply@innovarecode.com.br" });
  });
  it("respeita o nome informado", () => {
    expect(toMailFrom("Clínica X <a@b.com>")).toEqual({ name: "Clínica X", address: "a@b.com" });
  });
});
