---
name: bot-text-keys-ripple-to-frontend
description: Adicionar chave nova em BOT_TEXT_KEYS (src/core/bot/texts.ts) quebra o typecheck de qualquer Record<BotTextKeyLiteral, ...> exaustivo no frontend — checar antes de fechar a tarefa
metadata:
  type: project
---

`BOT_TEXT_KEYS`/`BotTextKeyLiteral` (`src/core/bot/texts.ts`) é a fonte única do enum de chaves de
texto do bot. Qualquer `Record<BotTextKeyLiteral, T>` no código (ex.:
`KEY_DESCRIPTION` em `src/app/(app)/[tenantSlug]/mensagens-bot/mensagens-bot-client.tsx`, a tela
"Mensagens do bot" da Lyra) é exaustivo por construção do TypeScript — adicionar uma chave nova
sem atualizar esses Records quebra o `tsc --noEmit`/build em arquivos que a própria mudança não
tocou diretamente.

**Por quê:** aconteceu ao adicionar os 8 `LABEL_*` (rótulos estruturais do menu, Fase 4b) — o
build só ficou verde depois de também estender `GROUPS`/`KEY_DESCRIPTION` naquele arquivo, que
era um arquivo NOVO e não commitado da Lyra (estava sendo construído em paralelo). Antes de
fechar uma tarefa que adiciona chave a `BOT_TEXT_KEYS`, `npx tsc --noEmit` cedo o suficiente para
achar todo `Record<BotTextKeyLiteral, ...>` afetado — e documentar no handoff quem precisa
reconciliar a edição paralela (aqui, Lyra: descrição humana de cada chave nova).

**Como evitar retrabalho:** sempre que uma chave nova entrar no enum `BotTextKey`
(migration `ALTER TYPE ... ADD VALUE`, ver `.claude/agent-memory/cronos/migrate_diff_sem_tty.md`),
espere também precisar tocar a tela de edição, mesmo que ela pareça "fora do seu módulo".
