import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Config separada para os testes de integração (`tests/integration/**`) — batem em Postgres
 * real, exigem `TEST_DATABASE_URL` (banco `innochat_test`, com as migrations aplicadas via
 * `npx prisma migrate deploy` contra ele) e por isso NUNCA entram no `npm test` padrão.
 * Rodar com: `npm run test:integration` (ver docs/contratos.md e o handoff da Vega para o
 * comando exato usado para preparar o banco).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.{test,spec}.ts"],
    testTimeout: 30_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
