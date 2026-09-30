// Roda um comando com DATABASE_URL apontando para o banco DEDICADO do simulador (`innochat_botsim`),
// derivado do DATABASE_URL do .env (sem imprimir nada). Banco próprio porque `innochat_test` é compartilhado
// com os testes de integração, que sobrescrevem o segredo interno da API a qualquer momento.
// Uso: node scripts/bot-sim/withdb.mjs <cmd...>      (cwd = pasta que tem o .env)
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = readFileSync(".env", "utf8");
const m = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
if (!m) { console.error("DATABASE_URL não encontrado no .env"); process.exit(1); }
const u = new URL(m[1]);
u.pathname = "/" + (process.env.BOTSIM_DB || "innochat_botsim");
const r = spawnSync(process.argv[2], process.argv.slice(3), { stdio: "inherit", shell: process.argv[2] !== "node", env: { ...process.env, DATABASE_URL: u.toString(), TEST_DATABASE_URL: u.toString() } });
process.exit(r.status ?? 1);
