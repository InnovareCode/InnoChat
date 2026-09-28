/**
 * Detecta `PrismaClientKnownRequestError` com `code === "P2002"` (violação de unique
 * constraint) por assinatura (`constructor.name`), sem `instanceof` de `@prisma/client`
 * (proibido fora de `src/lib/db/`, ver `eslint.config.mjs`) — extraído do padrão antes
 * duplicado em `src/modules/bot-api/claim.ts` e `src/modules/whatsapp/connection.ts`
 * (`.claude/agent-memory/vega/prisma_exclude_violation_shape.md`).
 *
 * Uso típico: dentro de um `try/catch` em volta de um `create()` que corre contra outra
 * transação concorrente para o MESMO registro (dedupe por constraint única é o backstop final
 * contra a corrida) — trata a violação como "já existe/já processado", nunca como erro 500.
 */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.constructor?.name === "PrismaClientKnownRequestError" && (error as unknown as { code?: string }).code === "P2002";
}
