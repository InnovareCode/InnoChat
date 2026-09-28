import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // DATABASE_URL fake por padrão: só precisa ser sintaticamente válida
    // para o PrismaClient instanciar (quando algum teste importar
    // getPrisma()). A maioria dos testes de unidade (core/, lib/db lógica
    // pura) nunca bate no banco de verdade. Quando `TEST_DATABASE_URL` está
    // definida (testes de integração com Postgres real — Fase 4+), ela também
    // vira o `DATABASE_URL` do processo.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://user:pass@localhost:5432/innochat_test",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
