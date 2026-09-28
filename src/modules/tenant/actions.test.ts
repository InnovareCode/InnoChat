import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

/**
 * `assertTenantCanWrite` na troca de tema (revisão de segurança 2026-09-28, achado BAIXA) —
 * mesma lacuna de `bot-text-actions.ts`.
 */

const TENANT = { id: "tenant-1", slug: "studio-demo", name: "Studio", timezone: "America/Sao_Paulo" };

const requireTenantMemberMock = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  requireTenantMember: requireTenantMemberMock,
}));

const assertTenantCanWriteMock = vi.fn();
vi.mock("@/modules/billing/service", () => ({
  assertTenantCanWrite: assertTenantCanWriteMock,
}));

const updateTenantThemeMock = vi.fn();
vi.mock("./service", () => ({
  updateTenantTheme: updateTenantThemeMock,
}));

const { updateTenantThemeAction } = await import("./actions");

afterEach(() => {
  vi.clearAllMocks();
});

describe("updateTenantThemeAction — bloqueio de escrita", () => {
  it("tenant SUSPENDED devolve TENANT_SUSPENDED, sem chamar updateTenantTheme", async () => {
    requireTenantMemberMock.mockResolvedValue({ tenant: TENANT, user: { id: "u1" } });
    assertTenantCanWriteMock.mockRejectedValue(new DomainError("TENANT_SUSPENDED", "Assinatura suspensa."));

    const result = await updateTenantThemeAction("studio-demo", { theme: "AMBAR_ESTUDIO" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TENANT_SUSPENDED");
    expect(updateTenantThemeMock).not.toHaveBeenCalled();
  });

  it("tenant ativo passa e chama updateTenantTheme normalmente", async () => {
    requireTenantMemberMock.mockResolvedValue({ tenant: TENANT, user: { id: "u1" } });
    assertTenantCanWriteMock.mockResolvedValue(undefined);
    updateTenantThemeMock.mockResolvedValue({ theme: "AMBAR_ESTUDIO" });

    const result = await updateTenantThemeAction("studio-demo", { theme: "AMBAR_ESTUDIO" });

    expect(result.ok).toBe(true);
    expect(updateTenantThemeMock).toHaveBeenCalledWith(TENANT.id, "AMBAR_ESTUDIO");
  });
});
