---
name: n8n-public-api-no-update-no-list-credentials
description: A API pública do n8n (/api/v1) não expõe GET nem update de credenciais — só POST/DELETE — e como isso molda a sincronização idempotente do InnoChat com o n8n
metadata:
  type: project
---

`src/modules/platform/n8n-sync.ts` + `n8n-client.ts` sobem a URL do painel, a URL da Evolution e
3 credenciais (`httpHeaderAuth`) para os workflows `innochat-bot`/`innochat-erros`. Ponto central
de design, registrado como conhecimento treinado (não confirmado ao vivo — **PENDÊNCIA real para
o Órion/dono confirmarem contra a instância de produção antes do primeiro uso**, ver
`docs/contratos.md`): a API pública do n8n só expõe `POST /credentials` (criar) e
`DELETE /credentials/{id}` — sem `GET` de lista, sem `GET` por id, sem update. É desenho
proposital do n8n (dado de credencial é só-escrita, para não permitir exfiltração via API).

Consequência prática: "atualizar" uma credencial é sempre **delete do id antigo + create de um
id novo** (`rotateCredential`), e o id novo precisa ser regravado em TODO nó do workflow que a
referencia (`rebindHttpCredentials`, classificando o nó pela URL que ele chama —
`evolutionUrl`/`n8nApiUrl`/`painelUrl` — em vez de uma lista fixa de nomes de nó, que quebraria
se um nó novo entrasse no workflow). Isso é o que torna a sync idempotente sem depender de listar
credenciais existentes: o id fica salvo em `PlatformSettings.n8nCred*Id` entre uma sync e outra.

O segredo interno do painel (`Authorization: Bearer <...>`) nunca fica em texto puro no banco (só
o hash, `internalApiSecretHash`) — a sync sempre chama `regenerateInternalApiSecret()` de novo
para ter um valor em texto puro para mandar ao n8n. Isso **rotaciona o segredo a cada sync**, de
propósito: é o único jeito de nunca precisar guardar/exibir o valor.

`PUT /workflows/{id}` (esse sim documentado com `GET`/`PUT`/`activate`/`deactivate`) exige o
corpo completo (`name`, `nodes`, `connections`, `settings`) — nunca ativa sozinho (ação separada
`activateBotWorkflowAction`/`deactivateBotWorkflowAction`).

Testado com mock de `fetch` (`tests/integration/platform-n8n-sync.integration.test.ts`) — nunca
rodou contra uma instância n8n real nesta sessão.
