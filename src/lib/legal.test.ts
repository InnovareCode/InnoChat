import { describe, expect, it } from "vitest";
import { assertCurrentTermsVersion, TERMS_VERSION } from "./legal";

describe("assertCurrentTermsVersion", () => {
  it("não lança quando a versão bate com TERMS_VERSION", () => {
    expect(() => assertCurrentTermsVersion(TERMS_VERSION)).not.toThrow();
  });

  it("lança DomainError com código TERMS_VERSION_OUTDATED para versão diferente (ex.: aba em cache)", () => {
    expect(() => assertCurrentTermsVersion("2020-01-01")).toThrowError(
      expect.objectContaining({ code: "TERMS_VERSION_OUTDATED" }),
    );
  });

  it("lança para string vazia", () => {
    expect(() => assertCurrentTermsVersion("")).toThrow();
  });
});
