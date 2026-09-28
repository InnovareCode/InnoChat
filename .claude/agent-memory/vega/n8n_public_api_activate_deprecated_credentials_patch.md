---
name: n8n-public-api-activate-deprecated-credentials-patch
description: Superfície real da API pública do n8n (activate/deactivate deprecated → publish/unpublish; PATCH de credencial existe mas com fallback; PUT de workflow só aceita 4 campos) e por que o cliente do InnoChat trata tudo com fallback
metadata:
  type: project
---

`src/modules/platform/n8n-client.ts` + `n8n-sync.ts` sobem a URL do painel, a URL da Evolution e
3 credenciais (`httpHeaderAuth`) para os workflows `innochat-bot`/`innochat-erros`. Primeira
versão desta memória (removida) tinha uma suposição errada — corrigida depois que o Atlas
conferiu o spec oficial (repo `n8n-io/n8n`, branch `master`,
`packages/cli/src/public-api/v1/handlers/**/spec`, consultado em 2026-09-28):

- **Ativar/desativar workflow**: `POST /workflows/{id}/activate`/`.../deactivate` **existem mas
  estão deprecated** — o caminho atual é `POST /workflows/{id}/publish`/`.../unpublish`.
  `n8nClient.activateWorkflow`/`deactivateWorkflow` tentam publish/unpublish primeiro e só caem
  para activate/deactivate se a instância responder 404 (versão antiga sem as rotas novas).
- **Credenciais**: a versão atual do spec TEM `GET /credentials`, `GET /credentials/{id}` e
  `PATCH /credentials/{id}` (update), além de `POST`/`DELETE` — não é "só escrita" como a
  memória anterior dizia. `rotateCredential` (`n8n-sync.ts`) tenta `PATCH` primeiro (mantém o
  mesmo id, evita rebind nos nós); se a instância responder 404/405, cai para "deletar o id
  antigo + criar um novo" — o caminho que funciona em QUALQUER versão, incluindo instâncias sem
  `PATCH`. Nunca assumir que uma instância específica tem uma coisa ou outra: sempre tentar o
  caminho novo e cair para o antigo em erro de rota/método, nunca em outro tipo de erro.
- **`PUT /workflows/{id}`**: exige só `name`/`nodes`/`connections`/`settings` — `id`, `active`,
  `createdAt`, `updatedAt`, `isArchived`, `versionId`, `triggerCount`, `tags`, `meta` são
  `readOnly` e quebram o PUT se enviados. `n8nClient.updateWorkflow` filtra para esses 4 campos
  sempre, nunca reenvia o objeto cru vindo de um `GET` anterior. `publishIfActive` (query param,
  padrão `true`) é deixado no padrão — não passamos o parâmetro.

**Padrão geral a repetir quando uma API externa tem versões divergentes**: tentar a rota/verbo
mais novo primeiro; capturar especificamente 404 (rota não existe) ou 405 (verbo não permitido)
para cair no caminho antigo; qualquer OUTRO status (401, 500, etc.) propaga como erro real — não
é "versão antiga", é falha de verdade. Ver `postWithFallback` em `n8n-client.ts` como
implementação de referência.

Testado com `fetch` mockado (`tests/integration/platform-n8n-sync.integration.test.ts`) — nunca
rodou contra uma instância n8n real; ainda é PENDÊNCIA confirmar a versão exata do n8n do dono
tem publish/unpublish e PATCH, ou vai cair nos fallbacks sempre.
