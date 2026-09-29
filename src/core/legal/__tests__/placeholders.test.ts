import { describe, expect, it } from "vitest";
import { fillLegalPlaceholders, formatCnpjDisplay, type PlatformLegalInfo } from "../placeholders";

const FULL_INFO: PlatformLegalInfo = {
  companyLegalName: "Innovare Code Tecnologia Ltda.",
  companyCnpj: "11444777000161",
  companyAddress: "Rua Exemplo, 123 — Curitiba/PR",
  contactEmail: "contato@innovarecode.com.br",
  dpoName: "Maria Encarregada",
  dpoEmail: "dpo@innovarecode.com.br",
  forumCity: "Curitiba",
  hostingRegion: "Brasil (São Paulo)",
  backupRetentionDays: 30,
};

const EMPTY_INFO: PlatformLegalInfo = {
  companyLegalName: null,
  companyCnpj: null,
  companyAddress: null,
  contactEmail: null,
  dpoName: null,
  dpoEmail: null,
  forumCity: null,
  hostingRegion: null,
  backupRetentionDays: null,
};

describe("formatCnpjDisplay", () => {
  it("formata 14 dígitos como 00.000.000/0000-00", () => {
    expect(formatCnpjDisplay("11444777000161")).toBe("11.444.777/0001-61");
  });

  it("devolve o valor original se não tiver 14 dígitos", () => {
    expect(formatCnpjDisplay("123")).toBe("123");
  });
});

describe("fillLegalPlaceholders", () => {
  it("substitui todos os marcadores conhecidos pelos valores cadastrados", () => {
    const text =
      "CNPJ [CNPJ], endereço [ENDEREÇO], contato [E-MAIL DE CONTATO], dpo [E-MAIL DO ENCARREGADO/DPO] " +
      "([NOME DO ENCARREGADO]), foro [COMARCA], hospedagem [PAÍS/REGIÃO DO PROVEDOR DE HOSPEDAGEM], " +
      "backups [PRAZO DE RETENÇÃO DOS BACKUPS].";

    const result = fillLegalPlaceholders(text, FULL_INFO);

    expect(result).toContain("CNPJ 11.444.777/0001-61");
    expect(result).toContain("endereço Rua Exemplo, 123 — Curitiba/PR");
    expect(result).toContain("contato contato@innovarecode.com.br");
    expect(result).toContain("dpo dpo@innovarecode.com.br (Maria Encarregada)");
    expect(result).toContain("foro Curitiba");
    expect(result).toContain("hospedagem Brasil (São Paulo)");
    expect(result).toContain("backups 30 dias");
    expect(result).not.toMatch(/\[CNPJ\]|\[ENDEREÇO\]/);
  });

  it("usa 'a definir' para cada marcador sem dado cadastrado", () => {
    const result = fillLegalPlaceholders("[CNPJ] [ENDEREÇO] [PRAZO DE RETENÇÃO DOS BACKUPS]", EMPTY_INFO);
    expect(result).toBe("a definir a definir a definir");
  });

  it("deixa marcador desconhecido intacto (nunca mascara silenciosamente algo sem campo mapeado)", () => {
    const result = fillLegalPlaceholders("veja a [Política de Privacidade](/privacidade)", FULL_INFO);
    expect(result).toBe("veja a [Política de Privacidade](/privacidade)");
  });

  it("não altera texto sem marcadores", () => {
    const result = fillLegalPlaceholders("texto qualquer sem colchetes", FULL_INFO);
    expect(result).toBe("texto qualquer sem colchetes");
  });
});
