import { describe, expect, it } from "vitest";
import { isTenantScopedModel, scopeArgsToTenant } from "../tenant-scope";

describe("isTenantScopedModel", () => {
  it("reconhece um model tenant-scoped", () => {
    expect(isTenantScopedModel("Contact")).toBe(true);
  });

  it("rejeita um model global", () => {
    expect(isTenantScopedModel("User")).toBe(false);
    expect(isTenantScopedModel("PlatformSettings")).toBe(false);
  });

  it("rejeita undefined sem lançar", () => {
    expect(isTenantScopedModel(undefined)).toBe(false);
  });
});

describe("scopeArgsToTenant", () => {
  const tenantId = "tn_123";

  it("injeta tenantId em where, mesmo que o chamador já tenha passado outro", () => {
    const result = scopeArgsToTenant({
      model: "Contact",
      operation: "findMany",
      args: { where: { tenantId: "tn_outro", name: "Maria" } },
      tenantId,
    });
    expect(result).toEqual({ where: { tenantId, name: "Maria" } });
  });

  it("cria where quando a operação não tinha nenhum", () => {
    const result = scopeArgsToTenant({
      model: "Contact",
      operation: "findFirst",
      args: {},
      tenantId,
    });
    expect(result).toEqual({ where: { tenantId } });
  });

  it("injeta tenantId em data no create", () => {
    const result = scopeArgsToTenant({
      model: "Contact",
      operation: "create",
      args: { data: { name: "Maria", tenantId: "tn_outro" } },
      tenantId,
    });
    expect(result).toEqual({ data: { name: "Maria", tenantId } });
  });

  it("injeta tenantId em cada item de createMany", () => {
    const result = scopeArgsToTenant({
      model: "Service",
      operation: "createMany",
      args: { data: [{ name: "Corte" }, { name: "Barba" }] },
      tenantId,
    });
    expect(result).toEqual({
      data: [
        { name: "Corte", tenantId },
        { name: "Barba", tenantId },
      ],
    });
  });

  it("injeta tenantId em where e create no upsert", () => {
    const result = scopeArgsToTenant({
      model: "Contact",
      operation: "upsert",
      args: { where: { waJid: "551199@s.whatsapp.net" }, create: { name: "Maria" }, update: {} },
      tenantId,
    });
    expect(result).toEqual({
      where: { waJid: "551199@s.whatsapp.net", tenantId },
      create: { name: "Maria", tenantId },
      update: {},
    });
  });

  it("lança para operação sem regra definida (fail fast)", () => {
    expect(() =>
      scopeArgsToTenant({ model: "Contact", operation: "executeRaw", args: {}, tenantId }),
    ).toThrow(/não tem regra de isolamento/);
  });
});
