import { defineConfig, devices } from "@playwright/test";

/**
 * Config SEPARADA só para `tests/e2e/instalacao.spec.ts`.
 *
 * Por quê: o `next dev` (Turbopack) trava um lock de "só um servidor dev por diretório de
 * projeto" — não por porta. O `playwright.config.ts` principal sobe SEMPRE seu próprio `next dev`
 * na porta 3000 (`webServer`, mesmo rodando só este arquivo), e o `beforeAll` de
 * `instalacao.spec.ts` sobe um SEGUNDO `next dev` na porta 3101 (apontando para `innochat_test`)
 * — as duas instâncias competem pelo MESMO lock (`.next/dev/logs`), mesmo em portas diferentes, e
 * a segunda sempre perde com "Another next dev server is already running." (achado ao rodar este
 * teste; confirmado inclusive invocando só este arquivo — o `webServer` da config principal ainda
 * assim sobe primeiro).
 *
 * Por isso este arquivo NÃO declara `webServer` nenhum — só `instalacao.spec.ts` gerencia seu
 * próprio processo (`beforeAll`/`afterAll`), sem nenhum outro `next dev` da MESMA pasta de
 * projeto disputando o lock.
 *
 * Rodar: `npx playwright test --config=playwright.instalacao.config.ts` — NUNCA junto com
 * `npm run test:e2e` na mesma invocação (o `webServer` principal, se já estiver de pé de uma
 * sessão anterior na mesma pasta, também colide). Sempre em execução própria e isolada.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "instalacao.spec.ts",
  timeout: 120_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
