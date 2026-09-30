# Simulador do bot (regressão do fluxo de agendamento)

Roda o **JS exato dos Code nodes** de `n8n/innochat-bot.json`, seguindo as conexões do workflow, e chama a
**API interna real** do painel (`/api/internal/v1/*`) contra um Postgres real. A Evolution é falsa: o
`sendText` só captura o texto que o bot enviaria. Serve para reproduzir conversas de WhatsApp de ponta a ponta
sem WhatsApp, sem n8n e sem mexer no banco de desenvolvimento.

| Arquivo | Papel |
|---|---|
| `engine.mjs` | Mini-executor do workflow: expressões `={{ }}`, Switch/IF/Code/HTTP/Wait/SplitOut, `$('Nó').first()`, `$runIndex`, fluxo de erro (libera a trava) |
| `chat.mjs` | Cliente de WhatsApp falso (payload `messages.upsert` da Evolution: texto, áudio, imagem, figurinha, vazio, `fromMe`) |
| `lib.mjs` | Helpers dos cenários: `Convo`, `parseOptions`, `api()` (chamada crua à API interna), `db()` (Prisma para arrumar estado) |
| `seed.mjs` | Cria os tenants `botsim-*` (idempotente) e grava `.seed.json` (não versionado) |
| `scenarios.mjs`, `scenarios-r2.mjs` | Os cenários. Cada `check()` descreve o comportamento **esperado**: falha = bug/regressão |
| `play.mjs` | Conversa manual: `node scripts/bot-sim/play.mjs bela 5511900000001 oi 1 1 "@audio"` |
| `withdb.mjs`, `create-db.mjs` | Apontam `DATABASE_URL` para o banco **dedicado** `innochat_botsim` (derivado do `.env`, nada é impresso) |

## Por que um banco dedicado

`innochat_test` é compartilhado com `npm run test:integration`, que **sobrescreve `PlatformSettings.internalApiSecretHash`**
(o segredo da API interna) a qualquer momento: o simulador tomaria 401 no meio da rodada. Por isso o simulador usa
`innochat_botsim` (`BOTSIM_DB=outro_nome` troca). O `seed.mjs` recusa rodar em banco que não seja `innochat_test`/`innochat_botsim`.

## Como rodar

Pré-requisito: `.env` com `DATABASE_URL` (Postgres local) e o Prisma Client gerado para o schema do commit
(`npx prisma generate`). Rode tudo na raiz do repositório (ou do worktree usado no build).

```bash
# 1. banco dedicado + migrations (uma vez)
node scripts/bot-sim/create-db.mjs
node scripts/bot-sim/withdb.mjs npx prisma migrate deploy

# 2. tenants de teste (rode de novo para "zerar" os agendamentos das rodadas anteriores)
node scripts/bot-sim/withdb.mjs node scripts/bot-sim/seed.mjs

# 3. painel em build de produção na porta 3900 (NÃO use o `next dev` da 3000)
#    `next build` sobrescreve `.next`: se houver `next dev` rodando nesta pasta, faça o build num
#    `git worktree add --detach <pasta> HEAD` (copie o .env para lá e ligue/copie node_modules).
node scripts/bot-sim/withdb.mjs npx next build
node scripts/bot-sim/withdb.mjs npx next start -p 3900

# 4. cenários (imprime o resumo e grava scripts/bot-sim/out/transcripts.md com as conversas completas)
node scripts/bot-sim/withdb.mjs node scripts/bot-sim/scenarios.mjs            # todos
node scripts/bot-sim/withdb.mjs node scripts/bot-sim/scenarios.mjs "^(C1|D5)$" # filtro por id (regex)
```

Variáveis: `BOTSIM_PANEL` (padrão `http://localhost:3900`), `BOTSIM_WORKFLOW` (outro JSON do workflow, ex.: o v2),
`BOTSIM_DB`. Encerre o `next start` ao terminar (só o seu processo).

Armadilhas encontradas ao montar isto (Windows):
- Turbopack recusa `node_modules` como junction/symlink ("points out of the filesystem root"): use `next build --webpack` nesse caso.
- Se o Prisma Client compartilhado em `node_modules/.prisma` foi gerado por OUTRO branch (coluna que o schema do commit não tem, ex.: `googleAuthEnabled`),
  o seed falha com `P2022`. Gere um client próprio no worktree (`prisma generate` com o `@prisma/client` copiado, não linkado).
- `withdb.mjs` só usa `shell` para comandos que não sejam `node`, então argumentos com `|`/`(` funcionam em `node ... scenarios.mjs "^(A|B)$"`.

## O que o simulador NÃO reproduz

Timeout de 10 s dos nós HTTP, credenciais/Header Auth, `Retry on fail` real (só repete 5xx), execução paralela de webhooks
dentro do n8n (a concorrência é testada com `Promise.all`, cada execução com sua trava real no banco), o envio real pela
Evolution (eco `fromMe` do próprio bot, falha de envio) e o relógio (o painel usa `new Date()`: virada de meia-noite é
coberta indiretamente pelos fusos extremos `tokyo`, `honolulu` e `kiribati`, que já estão em "outro dia" em relação ao UTC).

## Tenants do seed (`.seed.json`)

`bela` (America/Sao_Paulo; 13 serviços ativos + 1 inativo; Ana seg-sáb 9-18, Bruno ter-sex 10-16, Carla **sem expediente**, Dani inativa;
serviço sem profissional; serviço só da Carla), `tokyo` (+9), `honolulu` (-10), `kiribati` (+14), `vazio` (sem serviços),
`solo` (Manaus, `askProfessional=false`, 2 profissionais).
