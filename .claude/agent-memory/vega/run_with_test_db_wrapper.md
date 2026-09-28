---
name: run-with-test-db-wrapper
description: Script Node descartável para rodar prisma/vitest contra innochat_test sem nunca imprimir a senha do .env — e o bug de argv que fez ele falhar silenciosamente na primeira versão
metadata:
  type: project
---

Complementa [[integration_tests_setup]]: o wrapper que deriva `TEST_DATABASE_URL` a partir do
`.env` (troca o nome do banco `innochat` → `innochat_test` na connection string) e passa isso
como env var para um processo filho via `spawnSync`, sem nunca logar a URL (ver
[[never_print_env_contents]]).

**Bug real que custou uma rodada de debug**: a primeira versão usava
`const [, ...args] = process.argv;` para extrair o comando a rodar. Isso só descarta o PRIMEIRO
elemento (`node`), sobrando `[caminho-do-script, cmd, ...cmdArgs]` — o script tentava executar a
si mesmo como comando. `node script.mjs npx prisma migrate deploy` rodava silenciosamente sem
erro (exit 0) e sem output nenhum, porque `spawnSync("script.mjs", ["npx", "prisma", ...])` falha
de um jeito que não propaga stdio visível no caminho usado. **Correção**: `process.argv.slice(2)`
— descarta os DOIS primeiros (executável `node` + caminho do script), não só um.

**Script funcional** (recriar no scratchpad da sessão, não commitar):

```js
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const envContent = fs.readFileSync(".env", "utf-8");
const match = envContent.match(/^DATABASE_URL="?([^"\n]+)"?/m);
if (!match) { console.error("DATABASE_URL não encontrada no .env"); process.exit(1); }
const testUrl = match[1].replace(/\/innochat(\?|$)/, "/innochat_test$1");

const args = process.argv.slice(2); // node, script.mjs, <cmd>, ...args — descarta os 2 primeiros
const result = spawnSync(args[0], args.slice(1), {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, DATABASE_URL: testUrl, TEST_DATABASE_URL: testUrl },
});
process.exit(result.status ?? 1);
```

Uso: `node <scratchpad>/run-with-test-db.mjs npx prisma migrate deploy` (aplica migration no
banco de teste) ou `node <scratchpad>/run-with-test-db.mjs npm run test:integration`.

**Segunda pegadinha**: `vitest.integration.config.ts` lê `process.env.TEST_DATABASE_URL` (não
`DATABASE_URL`) para montar o `env` do processo de teste — por isso o wrapper precisa exportar
AMBAS as variáveis, não só `DATABASE_URL`. Setar só `DATABASE_URL` faz o vitest cair no fallback
`""` do config e o Prisma reclamar "You must provide a nonempty URL", sem deixar óbvio que o
problema é qual env var foi setada.
