import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Faz login pela UI de verdade (nunca injeta cookie/sessão) — é a própria tela que testamos. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

export async function loginAndWaitForPanel(page: Page, email: string, password: string, tenantSlug: string) {
  await login(page, email, password);
  await expect(page).toHaveURL(new RegExp(`/${tenantSlug}(/|$)`), { timeout: 10_000 });
}
