import { test, expect } from "@playwright/test";
import { SEED_TENANT_SLUG } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";

/**
 * docs/contratos.md Fase 1/2: `friendlyTimezoneLabel`/`formatLongDateLabel`
 * (`src/components/lib/format-date.ts`) — "Horário de Brasília" (nunca o identificador IANA
 * cru), nenhuma data com "De"/"Feira" maiúsculo (armadilha documentada no próprio arquivo: o bug
 * vinha da classe `capitalize` do Tailwind, não do `Intl`), dia sem zero à esquerda.
 *
 * Sessão via `storageState` (ver `admin-secrets.spec.ts` / `login_rate_limit_e2e` na memória).
 */
test.use({ storageState: OWNER_STORAGE_STATE });

test.describe("Datas e fuso horário no painel", () => {

  test("Agenda mostra 'Horário de Brasília' (nunca o identificador IANA cru)", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await expect(page.getByText("Horário de Brasília")).toBeVisible();
    await expect(page.getByText("America/Sao_Paulo")).toHaveCount(0);
  });

  test("rótulo de data por extenso: sem 'De'/'Feira' maiúsculo no meio, dia sem zero à esquerda", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);

    const label = await page.locator("p.text-sm.font-medium.text-text").first().textContent();
    expect(label).toBeTruthy();

    // Só a PRIMEIRA letra é maiúscula ("Terça-feira, 5 de outubro" — nunca "Terça-Feira" nem "5 De outubro").
    expect(label).not.toMatch(/-Feira/);
    expect(label).not.toMatch(/ De /);
    // Dia sem zero à esquerda: "5 de outubro", nunca "05 de outubro".
    expect(label).not.toMatch(/\b0\d de /);
  });

  test("cabeçalho da semana também não capitaliza 'de'/mês por palavra inteira", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await page.getByRole("button", { name: "Semana" }).click();

    const label = await page.locator("p.text-sm.font-medium.text-text").first().textContent();
    expect(label).toBeTruthy();
    expect(label).toMatch(/^Semana de /); // só a primeira letra maiúscula
    expect(label).not.toMatch(/ De /);
  });
});
