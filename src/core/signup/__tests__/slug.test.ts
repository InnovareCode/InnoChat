import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS, slugify, validateSlug } from "../slug";

describe("slugify", () => {
  it("normaliza acentos, espaços e maiúsculas", () => {
    expect(slugify("Estúdio Beleza & Cia")).toBe("estudio-beleza-cia");
  });

  it("remove hífens duplicados nas pontas", () => {
    expect(slugify("  --Salão--  ")).toBe("salao");
  });
});

describe("validateSlug", () => {
  it("aceita um slug válido", () => {
    expect(validateSlug("estudio-bela")).toBeNull();
  });

  it.each(RESERVED_SLUGS)("rejeita o slug reservado %s", (slug) => {
    // Só os que já satisfazem o formato/tamanho testam a regra RESERVED de fato; os demais
    // (ex.: "_next", "favicon.ico") já falham antes por formato — o que também é correto:
    // nunca deveriam ser aceitos.
    const result = validateSlug(slug);
    expect(result).not.toBeNull();
  });

  it("rejeita muito curto", () => {
    expect(validateSlug("ab")).toBe("TOO_SHORT");
  });

  it("rejeita formato inválido (maiúscula, espaço, underscore)", () => {
    expect(validateSlug("Estudio Bela")).toBe("INVALID_FORMAT");
    expect(validateSlug("estudio_bela")).toBe("INVALID_FORMAT");
  });

  it("rejeita hífen nas pontas ou duplicado", () => {
    expect(validateSlug("-estudio")).toBe("INVALID_FORMAT");
    expect(validateSlug("estudio--bela")).toBe("INVALID_FORMAT");
  });
});
