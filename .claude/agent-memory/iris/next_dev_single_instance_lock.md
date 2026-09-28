---
name: next-dev-single-instance-lock-per-directory
description: Turbopack (next dev) recusa uma segunda instância a partir da MESMA pasta de projeto mesmo em porta diferente — trava toda tentativa de subir um segundo "next dev" isolado (ex.: /instalacao contra innochat_test) enquanto o webServer principal já está de pé
metadata:
  type: project
---

`next dev` (Turbopack, Next 16) trava um lock de "só uma instância por diretório de projeto"
(`.next/dev/logs/next-development.log` + PID) — **não é por porta**. Tentar `spawn` um segundo
`next dev -p 3101` (ex.: para testar `/instalacao` contra `innochat_test`, isolado do banco de
dev) falha com `"Another next dev server is already running."` sempre que QUALQUER outro `next
dev` da MESMA pasta já estiver de pé — inclusive o `webServer` do `playwright.config.ts`
principal, que sobe SEMPRE (mesmo rodando só um arquivo isolado) antes de qualquer teste.

**Sintoma confuso:** o erro só aparece no `stderr` do processo filho — sem capturar
`stdout`/`stderr`/`exit` do `child_process.spawn` explicitamente, o teste só mostra "servidor não
respondeu a tempo" (timeout genérico), escondendo a causa real.

**Como aplicar:** um teste que precisa do seu PRÓPRIO `next dev` isolado (`/instalacao` contra
`innochat_test`, nunca contra o banco de dev) precisa rodar numa config Playwright SEPARADA, SEM
`webServer` nenhum (`playwright.instalacao.config.ts` é o modelo) — e essa config só pode rodar
sozinha (`npx playwright test --config=playwright.instalacao.config.ts`), nunca junto com
`npm run test:e2e` na mesma invocação/mesmo `next dev` já ativo. `playwright.config.ts` principal
tem `testIgnore` para esse arquivo, de propósito.

Ver `tests/e2e/instalacao.spec.ts` e `playwright.instalacao.config.ts`.
