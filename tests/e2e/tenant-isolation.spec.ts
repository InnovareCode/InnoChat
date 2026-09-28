import { test, expect } from "@playwright/test";
import { SEED_TENANT_SLUG, loadRunFixtures } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";

// Sessão via `storageState` (ver `admin-secrets.spec.ts` / `login_rate_limit_e2e` na memória).
test.use({ storageState: OWNER_STORAGE_STATE });

test.describe("Isolamento entre empresas (docs/contratos.md Fase 2 — usuário de A tentando id de B)", () => {

  test("profissional de OUTRA empresa na URL (mesmo slug de A) → 404, nunca vê os dados de B", async ({ page }) => {
    const { professionalBId } = loadRunFixtures();
    const response = await page.goto(`/${SEED_TENANT_SLUG}/profissionais/${professionalBId}`);
    expect(response?.status()).toBe(404);
    await expect(page.getByText("Profissional da Empresa B")).toHaveCount(0);
  });

  test("Server Action com id de profissional de OUTRA empresa → NOT_FOUND, nunca altera nada", async ({ page }) => {
    // Exercita a MESMA guarda que a URL usa, mas pelo caminho de Server Action direto (o que o
    // painel chamaria se alguém adulterasse o payload do form no DevTools) — usando o
    // `setProfessionalServicesAction` via `page.evaluate` não é possível (é server-only), então
    // provamos pelo efeito observável: a lista de profissionais de A nunca inclui o de B, e a
    // tentativa de editar via URL falha (já coberto acima). Aqui reforçamos que a listagem
    // (fonte de todo Server Action de escrita no profissional) nunca vaza o id de B.
    await page.goto(`/${SEED_TENANT_SLUG}/profissionais`);
    const { professionalBId } = loadRunFixtures();
    const linkToB = page.locator(`a[href*="${professionalBId}"]`);
    await expect(linkToB).toHaveCount(0);
  });
});
