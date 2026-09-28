/**
 * Hook de instrumentação do Next.js — `register()` roda uma vez no boot do servidor, antes de
 * qualquer requisição. Usado só para o bootstrap do primeiro admin da plataforma
 * (docs/contratos.md — "Configuração pela plataforma"): se não houver admin, gera e imprime o
 * código de instalação (`src/modules/platform/install.ts`).
 *
 * Guardado por `NEXT_RUNTIME === "nodejs"`: o Next também chama `register()` no runtime Edge
 * (middleware), onde não há Prisma/Node APIs — sem isso, o boot Edge tentaria importar Prisma e
 * quebraria. Não há migration nem query de escrita pesada aqui (docs/arquitetura.md §14:
 * "migration... nunca no boot") — só leitura de `User` e, na ausência de admin, um `create`
 * pequeno em `PlatformInstallCode`.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { bootstrapInstallCodeIfNeeded } = await import("@/modules/platform/install");
  const { logger } = await import("@/lib/logger");

  try {
    await bootstrapInstallCodeIfNeeded();
  } catch (error) {
    // Nunca derruba o boot do servidor por causa disto — sem código de instalação impresso, o
    // operador ainda pode investigar o log e reiniciar o container para tentar de novo.
    logger.error("platform.install.bootstrap_failed", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
