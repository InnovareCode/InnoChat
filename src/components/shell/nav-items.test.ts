import { describe, expect, it } from "vitest";
import { adminNavItems, NAV_ICON_KEYS, navIconFor, tenantNavItems, tenantOnboardingItem } from "./nav-items";

describe("nav-items: fonte única dos ícones de página", () => {
  it("todo item do menu (empresa e admin) tem ícone", () => {
    for (const item of [...tenantNavItems("acme", { includeOnboarding: true }), ...adminNavItems]) {
      expect(item.icon, item.label).toBeTruthy();
    }
  });

  it("navIconFor devolve o mesmo componente que o menu usa (empresa)", () => {
    for (const item of tenantNavItems("acme")) {
      const key = item.href.replace("/acme/", "");
      expect(navIconFor(key), item.label).toBe(item.icon);
    }
    expect(navIconFor("onboarding")).toBe(tenantOnboardingItem("acme")?.icon);
  });

  it("navIconFor devolve o mesmo componente que o menu usa (admin)", () => {
    for (const item of adminNavItems) {
      expect(navIconFor(item.href.replace(/^\//, "")), item.label).toBe(item.icon);
    }
  });

  it("chave desconhecida lança em vez de cabeçalho sem ícone", () => {
    expect(() => navIconFor("inexistente")).toThrow();
    expect(NAV_ICON_KEYS.length).toBeGreaterThan(10);
  });
});
