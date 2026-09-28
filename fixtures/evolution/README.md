# Fixtures da Evolution API v2 — NÃO capturadas do servidor real

Estes payloads foram montados a partir da **documentação pública** da Evolution API v2
(Baileys) e do formato descrito em `docs/arquitetura.md` §6.9 — **não são uma captura real**
de webhook. A Fase 0 (dados do dono + spike Evolution, `docs/arquitetura.md` §13) ainda não
tem as credenciais para gerar payloads reais.

Cada arquivo tem um campo `"_source"` marcando essa origem. **Quando os payloads reais
chegarem (Fase 0), substituir estes arquivos e rodar de novo `src/core/bot/__tests__/
evolution-normalize.test.ts`** — se algum campo tiver nome diferente do assumido aqui
(`key.remoteJid`, `key.remoteJidAlt`, `data.senderPn`, `message.conversation`,
`message.extendedTextMessage.text`, `messageTimestamp`), o teste vai falhar e apontar
exatamente o que `src/core/bot/evolution-normalize.ts` precisa mudar — é o objetivo de isolar
a normalização num módulo puro único (pedido do Atlas no briefing da Fase 4).

| Arquivo | Cenário |
|---|---|
| `text-conversation.json` | Mensagem de texto simples (`message.conversation`) |
| `text-extended.json` | Texto com resposta/citação (`message.extendedTextMessage.text`) |
| `lid-sender.json` | Remetente `@lid` com `remoteJidAlt` presente (resolve para o número) |
| `lid-sender-no-alt.json` | Remetente `@lid` SEM alternativa (vira `UNRESOLVABLE_SENDER`) |
| `group-message.json` | Mensagem de grupo (`@g.us`) — ignorado |
| `media-message.json` | Mídia (`imageMessage`) — vira `ONLY_TEXT` no n8n |
| `from-me.json` | Eco do próprio número (`key.fromMe: true`) |
| `connection-update.json` | Evento `connection.update` (consumido por `/connection-events`, não por `/messages/claim`) |
| `garbage.json` | Payload malformado/irreconhecível — prova que nunca gera 5xx |
