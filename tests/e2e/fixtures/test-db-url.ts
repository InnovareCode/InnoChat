import fs from "node:fs";
import path from "node:path";

/**
 * Deriva a connection string do banco `innochat_test` a partir do `DATABASE_URL` do `.env`
 * (que aponta para `innochat`, o banco de DEV) — troca só o nome do banco no fim da string,
 * NUNCA imprime o valor resultante (tem a senha embutida). Mesmo padrão documentado em
 * `.claude/agent-memory/vega/integration_tests_setup.md`: evita expor a credencial em log/stdout
 * mesmo que o classificador de permissões deixasse (não deixa) um `cat .env` direto.
 */
export function deriveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const envPath = path.join(process.cwd(), ".env");
  const content = fs.readFileSync(envPath, "utf-8");
  const match = content.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL não encontrado em .env — não há como derivar o banco de teste.");
  const devUrl = match[1].trim();
  // Troca o nome do banco (último segmento do path) por "innochat_test".
  const testUrl = devUrl.replace(/\/([a-zA-Z0-9_]+)(\?.*)?$/, "/innochat_test$2");
  if (testUrl === devUrl) throw new Error("Não foi possível derivar innochat_test a partir de DATABASE_URL.");
  return testUrl;
}
