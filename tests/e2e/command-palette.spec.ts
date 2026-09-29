import { test, expect } from "@playwright/test";
import { SEED_TENANT_SLUG } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";

/**
 * Paleta de comando (Ctrl+K, docs/design/premium-spec.md §1/§3 — `src/components/shell/command-palette.tsx`).
 * Sessão via `storageState` (ver `login_rate_limit_e2e` na memória) — nenhum destes testes precisa
 * logar de novo.
 */
test.use({ storageState: OWNER_STORAGE_STATE });

test.describe("Paleta de comando (Ctrl+K)", () => {
  test("Ctrl+K abre a paleta, busca filtra e Enter/clique navega para a tela", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await expect(page.getByRole("dialog").filter({ hasText: "Buscar tela ou ação" })).toHaveCount(0);

    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const input = page.getByLabel("Buscar tela ou ação");
    await expect(input).toBeFocused();

    await input.fill("clientes");
    const clientesResult = dialog.getByRole("button", { name: "Clientes", exact: true });
    await expect(clientesResult).toBeVisible();
    await clientesResult.click();
    await expect(page).toHaveURL(new RegExp(`/${SEED_TENANT_SLUG}/clientes$`));
    await expect(dialog).toBeHidden();

    // Ctrl+K de novo fecha (toggle) sem navegar.
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("'Novo agendamento' na paleta abre a Agenda com o diálogo de novo agendamento já aberto", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/clientes`);
    await page.keyboard.press("Control+k");
    await page.getByRole("button", { name: "Novo agendamento" }).click();
    await expect(page).toHaveURL(new RegExp(`/${SEED_TENANT_SLUG}/agenda\\?novo=1`));
    await expect(page.getByRole("dialog").filter({ hasText: "Novo agendamento" })).toBeVisible();
  });

  test("'Novo cliente' na paleta abre Clientes com o diálogo de cadastro já aberto", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await page.keyboard.press("Control+k");
    await page.getByRole("button", { name: "Novo cliente" }).click();
    await expect(page).toHaveURL(new RegExp(`/${SEED_TENANT_SLUG}/clientes`));
    await expect(page.getByRole("dialog").filter({ hasText: "Novo cliente" })).toBeVisible();
    // A URL volta a ficar limpa depois de abrir o diálogo (não fica presa em `?novo=1`).
    await expect(page).toHaveURL(new RegExp(`/${SEED_TENANT_SLUG}/clientes$`));
  });

  test("busca sem resultado mostra o estado vazio, sem quebrar", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await page.keyboard.press("Control+k");
    const input = page.getByLabel("Buscar tela ou ação");
    // Ao abrir, um efeito com `setTimeout(fn, 0)` zera a busca e foca o campo (evita o lint
    // `react-hooks/set-state-in-effect`, ver `command-palette.tsx`) — pode correr DEPOIS do
    // primeiro `fill`, apagando o texto digitado. `expect(...).toHaveValue` com retry absorve
    // essa corrida em vez de um `fill` único que pode ser sobrescrito.
    await expect(input).toBeFocused();
    await input.fill("xyz-nao-existe-123");
    await expect(input).toHaveValue("xyz-nao-existe-123");
    await expect(page.getByText(/Nada encontrado para/).first()).toBeVisible();
  });
});
