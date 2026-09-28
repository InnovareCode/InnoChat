import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do painel (docs/arquitetura.md §8, docs/contratos.md "o que a Íris deve testar").
 *
 * Sobe `next start` (build de produção) na porta 3000 contra o banco de DEV (`innochat`, com
 * `npm run db:seed` já aplicado) — NUNCA contra `innochat_test` (esse é do `test:integration`).
 * `AUTH_URL` do `.env` já é `http://localhost:3000`, então não precisa sobrescrever nada aqui.
 *
 * Isolamento dos dados que o teste cria: cada spec usa nomes com timestamp/uuid (ver
 * `tests/e2e/fixtures/test-data.ts`) e um `globalTeardown` best-effort limpa pelo prefixo — nunca
 * apaga o tenant/usuário de seed (`studio-demo` / `dev@innochat.local`).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // várias specs escrevem no MESMO tenant de seed — evita corrida de dados
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
