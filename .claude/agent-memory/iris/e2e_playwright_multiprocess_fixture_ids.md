---
name: e2e-playwright-multiprocess-fixture-ids
description: Por que um prefixo gerado com Date.now() no módulo de fixtures do Playwright quebra login de usuários criados no global-setup — global-setup e specs rodam em processos separados
metadata:
  type: project
---

`playwright.config.ts` roda `global-setup.ts` no processo PRINCIPAL do test runner; cada arquivo
de spec roda no seu próprio processo de WORKER. Um módulo `fixtures/test-data.ts` que calcula
`const E2E_RUN_PREFIX = Date.now()` no top-level é reavaliado (import fresco) em CADA processo —
o valor gerado no `global-setup.ts` (que cria o usuário STAFF/tenant B no banco) é DIFERENTE do
valor que o spec recalcula ao montar o e-mail de login. Resultado: login falha com "E-mail ou
senha inválidos." mesmo com a senha certa, porque o e-mail que o teste tenta logar nunca existiu.

**Sintoma que confundiu na hora de debugar:** a mensagem de erro genérica de login (proposital,
anti-enumeration) não distingue "usuário não existe" de "senha errada" — só um `console.log` do
registro do banco (`prisma.user.findUnique`) direto no teste revelou que os e-mails eram
string-diferentes com o MESMO prefixo textual mas timestamps diferentes.

**Como aplicar:** qualquer identificador que precise ser IGUAL entre `global-setup.ts` e um
spec (e-mail de login, slug usado em `page.goto`) tem que ser gerado UMA VEZ no `global-setup.ts`
e persistido em disco (`tests/e2e/.e2e-fixture-ids.json`, no `.gitignore`) — os specs LEEM esse
arquivo (`loadRunFixtures()`), nunca recalculam. Um prefixo usado só DENTRO do processo do
próprio spec (nomear um serviço/profissional criado e depois procurado pelo mesmo arquivo) não
tem esse problema — pode continuar sendo `Date.now()` local ao módulo.

Ver também [[e2e_suite_layout]].
