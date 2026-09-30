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
    // Ver `tests/integration/setup.ts`: fora de uma requisição HTTP, `getPublicBaseUrl()`
    // (src/lib/public-url.ts) precisa de `PlatformSettings.publicBaseUrl` — sem isto, todo
    // teste que passa por `signUp`/`billing/tick`/e-mails com link quebraria com
    // `PUBLIC_URL_UNKNOWN`.
    setupFiles: ["tests/integration/setup.ts"],
    testTimeout: 30_000,
    // Todos os arquivos de integração batem no MESMO Postgres real, e alguns (Fase 7 — billing)
    // fazem varredura GLOBAL de tabelas (`Subscription`/`Invoice` sem filtro de tenant, de
    // propósito: é o que `billing/tick` faz em produção). Rodar arquivos em paralelo faz um
    // arquivo enxergar fixtures de outro a meio caminho de ser limpas no `afterAll` dele —
    // Prisma acusa "Inconsistent query result" quando isso corta uma relação obrigatória no
    // meio de um include. Sequencial evita a corrida; o custo de tempo é aceitável para uma
    // suíte de integração (não faz parte do `npm test` padrão).
    fileParallelism: false,
    // `next-auth` importa `next/server` sem extensão (ESM estrito do Node não resolve); inline faz o
    // Vite resolver. Necessário para testar o route handler do Auth.js de verdade.
    server: { deps: { inline: ["next-auth"] } },
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      // `src/env.ts` valida isto na borda do processo (Fase 7, `src/modules/billing/service.ts`
      // e `src/modules/signup/service.ts` importam `@/env`) — valores fake, só para o parse do
      // zod passar; nenhum destes é usado de verdade nos testes de integração (não sobem um
      // servidor Next real, não fazem `signIn`).
      AUTH_SECRET: process.env.AUTH_SECRET ?? "test-secret-not-used-in-integration-tests",
      AUTH_URL: process.env.AUTH_URL ?? "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
