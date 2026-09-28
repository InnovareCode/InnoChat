import { test, expect } from "@playwright/test";
import { login } from "./fixtures/auth";
import { SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD } from "./fixtures/test-data";

/**
 * dev@innochat.local também é platform admin (seed) — usado aqui para testar
 * Configurações da plataforma (docs/contratos.md Fase 1: "salvar segredo e confirmar que nunca
 * volta em texto puro; segredo interno exibido uma vez").
 */
test.describe("Admin da plataforma: segredos nunca voltam em texto puro", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    await page.waitForURL(/\/(studio-demo|admin)/); // espera o cookie de sessão valer antes de navegar
    await page.goto("/admin/configuracoes");
  });

  test("chave da Evolution salva: campo limpa, hint mostra só o rótulo mascarado, e reabrir a tela nunca reexibe o valor digitado", async ({ page }) => {
    const plaintextKey = "chave-super-secreta-evolution-e2e-12345";
    await page.getByLabel("Chave da Evolution").fill(plaintextKey);
    await page.getByRole("button", { name: "Salvar" }).first().click();

    // Confirma que salvou (hint com o servidor mascarado) e que o campo não guarda o texto digitado.
    await expect(page.getByText(/Chave atual: ••••2345\./)).toBeVisible();
    await expect(page.getByLabel("Chave da Evolution")).toHaveValue("");

    // A garantia que importa de verdade — persistida, sobrevive a reload: reabrindo a tela do
    // zero, o valor digitado NUNCA reaparece em lugar nenhum do HTML (nem escondido).
    await page.reload();
    await expect(page.getByText(/Chave atual: ••••2345\./)).toBeVisible();
    const htmlAfterReload = await page.content();
    expect(htmlAfterReload).not.toContain(plaintextKey);
  });

  test("segredo interno da API é mostrado em texto puro só UMA vez, no dialog de geração", async ({ page }) => {
    await page.getByRole("button", { name: /Gerar( novo)? segredo/ }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Segredo gerado" });
    await expect(dialog).toBeVisible();

    const secretCode = dialog.locator("code");
    const secretValue = (await secretCode.textContent())?.trim() ?? "";
    expect(secretValue.length).toBeGreaterThan(10);

    await page.getByRole("button", { name: "Já copiei, fechar" }).click();
    await expect(dialog).toBeHidden();

    // Depois de fechado, o segredo não aparece em lugar nenhum da página — só o status "Configurado".
    const htmlAfterClose = await page.content();
    expect(htmlAfterClose).not.toContain(secretValue);
    await expect(page.getByText("Configurado", { exact: true })).toBeVisible();

    // Reabrir a tela (reload) também nunca reexibe o valor gerado — a action só devolve o
    // booleano `internalApiSecretConfigured`, nunca o segredo/hash de volta.
    await page.reload();
    const htmlAfterReload = await page.content();
    expect(htmlAfterReload).not.toContain(secretValue);
    await expect(page.getByText("Configurado", { exact: true })).toBeVisible();
  });
});
