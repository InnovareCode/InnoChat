import { test, expect } from "@playwright/test";
import { login } from "./fixtures/auth";
import { SEED_TENANT_SLUG, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD, loadRunFixtures } from "./fixtures/test-data";

test.describe("Autenticação e proteção de rota (docs/contratos.md Fase 1)", () => {
  test("login com credenciais corretas leva ao painel da empresa", async ({ page }) => {
    await login(page, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    await expect(page).toHaveURL(new RegExp(`/${SEED_TENANT_SLUG}/agenda`));
  });

  test("senha errada mostra mensagem genérica (sem dizer se o e-mail existe)", async ({ page }) => {
    await login(page, SEED_OWNER_EMAIL, "senha-totalmente-errada");
    await expect(page).toHaveURL(/\/login$/);
    const alert = page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("E-mail ou senha inválidos.");
  });

  test("e-mail inexistente mostra a MESMA mensagem genérica (sem enumeration)", async ({ page }) => {
    await login(page, "ninguem-com-este-email@e2e.innochat.local", "qualquer-coisa-123");
    await expect(page).toHaveURL(/\/login$/);
    const alert = page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." });
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText("E-mail ou senha inválidos.");
  });

  test("rota protegida sem sessão redireciona para /login", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await expect(page).toHaveURL(/\/login/);
  });

  test("tenant alheio (slug que não existe, ou que o usuário não é membro) devolve 404, nunca 403", async ({ page }) => {
    await login(page, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    await page.waitForURL(new RegExp(`/${SEED_TENANT_SLUG}(/|$)`));

    // Empresa que existe, mas o usuário logado (OWNER só de studio-demo) não é membro dela.
    const { tenantBSlug } = loadRunFixtures();
    const response = await page.goto(`/${tenantBSlug}/agenda`);
    expect(response?.status()).toBe(404);

    // Slug que nem existe.
    const response2 = await page.goto(`/empresa-que-nunca-existiu-e2e/agenda`);
    expect(response2?.status()).toBe(404);
  });

  test("botão Sair encerra a sessão e volta para /login", async ({ page }) => {
    await login(page, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    await page.waitForURL(new RegExp(`/${SEED_TENANT_SLUG}(/|$)`));

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);

    // Sessão de fato encerrada: rota protegida volta a mandar para /login.
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await expect(page).toHaveURL(/\/login/);
  });
});
