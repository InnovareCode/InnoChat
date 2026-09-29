---
name: n8n-webhook-path-param-prefixed-by-webhookid
description: Causa raiz do bot mudo em produção (2026-09-29) — n8n prefixa com o webhookId o webhook cujo path tem parâmetro; a base agora é derivada no syncN8n
metadata:
  type: project
---

**Sintoma:** bot não responde no WhatsApp e o n8n não mostra nenhuma execução. **Causa raiz:** o nó
Webhook do `innochat-bot` tem `path: "innochat/evolution/:token"`; com parâmetro dinâmico o n8n
registra a rota como `/webhook/<webhookId>/innochat/evolution/:token`. O painel montava
`<n8nWebhookBaseUrl>/<webhookToken>` sem o webhookId → 404 "webhook not registered" (curl provou).

**Correção:** `deriveWebhookBaseUrl` (`src/modules/platform/n8n-sync.ts`) deriva a base do nó no
`syncN8n` e sobrescreve `PlatformSettings.n8nWebhookBaseUrl`; o mesmo sync reaponta
(`evolution.setWebhook`) todas as instâncias com `deletedAt = null`, contando falhas sem abortar.

**Como evitar:** nunca montar URL de webhook do n8n à mão — derivar do nó. Se o workflow for
reimportado, o webhookId muda: sincronizar de novo. "Atualizar status" do tenant NÃO reaplica webhook.
Pendência: verificação automática (Saúde) da URL derivada não feita — exigiria POST que pode
disparar execução real do bot.
