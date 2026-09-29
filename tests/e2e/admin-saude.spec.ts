import { test, expect } from "@playwright/test";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";

/**
 * Admin → Saúde (`/admin/saude`) — renderiza sem quebrar mesmo com as integrações (Evolution,
 * n8n, SMTP, Mercado Pago) não configuradas neste ambiente (`PlatformSettings` sem os campos
 * preenchidos). Complementa o smoke genérico (`smoke.spec.ts`) com asserções específicas do
 * conteúdo desta tela.
 */
test.use({ storageState: OWNER_STORAGE_STATE });

test.describe("Admin → Saúde", () => {
  test("renderiza os 4 cartões de integração e os 2 jobs periódicos mesmo sem nada configurado", async ({ page }) => {
    await page.goto("/admin/saude");
    await expect(page.getByRole("heading", { name: "Saúde" })).toBeVisible();

    for (const label of ["Evolution", "n8n", "SMTP", "Mercado Pago"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "billing/tick" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "maintenance/tick" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Volume operacional" })).toBeVisible();

    // "Atualizar" (Server Action de verdade) não quebra a tela mesmo sem nada configurado.
    await page.getByRole("button", { name: "Atualizar" }).click();
    await expect(page.getByRole("heading", { name: "Saúde" })).toBeVisible();
  });
});
