---
name: connection-event-parser-must-not-require-instance-field
description: Bug real — parseConnectionEvent exigindo o campo `instance` do corpo quebrou os testes de /connection-events já verdes desde a Fase 4, porque o tenant/instância já vem resolvido pelo webhookToken do path
metadata:
  type: project
---

**Causa raiz:** ao escrever `src/core/whatsapp/connection-event.ts` (Fase 3, conexão WhatsApp),
copiei o estilo de `src/core/bot/evolution-normalize.ts` (que exige `instance` no corpo porque é
usado pelo `claim`, cujo teste sempre manda esse campo) sem checar que os testes de
`/connection-events` já existentes desde a Fase 4
(`tests/integration/bot-api-gaps.integration.test.ts`) mandam payloads **sem** `instance`
nenhum — porque o endpoint já resolve a instância pelo `webhookToken` do path
(`X-InnoChat-Instance`, `resolveInternalRequest`), nunca pelo corpo (docs/contratos.md §6.1: "o
`tenantId` nunca é aceito [no corpo]"). Exigir `instance` no parser fazia `parseConnectionEvent`
devolver `null` para todo evento de conexão real, e 3 testes que já passavam viraram
`applied: false` inesperado.

**Correção:** `parseConnectionEvent` **ignora** o campo `instance` do corpo — só valida
`event === "CONNECTION_UPDATE"` e `data.state` reconhecido. Quem chama (`applyConnectionEvent`,
`src/modules/bot-api/connection-events.ts`) usa `ctx.instance.instanceName`/`ctx.instance.id`
(já resolvidos pela auth) para tudo, nunca um `instanceName` vindo do payload parseado.

**Como evitar:** antes de escrever um parser puro novo para um endpoint que JÁ resolve a
identidade fora do corpo (qualquer rota de `/api/internal/v1/*`, [[for_tenant_scope_limits]]),
rodar a suíte de integração daquele endpoint ANTES de generalizar/trocar a implementação —
`npm run test:integration -- <arquivo>` é rápido o suficiente para pegar isso cedo. Ver também
[[extend_dont_fork_shared_domain_fn]]: o princípio de reaproveitar é o mesmo, mas aqui o erro foi
o INVERSO — um parser novo ficou mais restritivo do que o contrato que já existia.
