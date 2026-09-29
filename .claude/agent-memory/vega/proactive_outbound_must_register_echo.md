---
name: proactive-outbound-must-register-echo
description: Mensagem enviada pelo backend (fora do n8n), ex. lembrete de véspera, precisa registrar o hash em ChatSession.recentOutbound antes de enviar, senão o claim pausa o bot do cliente
metadata:
  type: project
---

O `claim` (`src/modules/bot-api/claim.ts`) trata todo evento `fromMe` que não bate com um hash de
`ChatSession.recentOutbound` (janela de 2 min) como "humano assumiu" e pausa o bot do contato por
`humanPauseMin` (12h padrão). Um envio proativo pelo `EvolutionClient.sendText` volta como `fromMe`.

**Como aplicar:** `src/modules/reminders/tick.ts#registerOutboundEcho` faz upsert da ChatSession e
usa `appendRecentOutbound` ANTES do envio (o webhook pode chegar antes do retorno do POST). Qualquer
novo envio proativo (campanha, aviso) deve fazer o mesmo.

Outras decisões: tentativas do lembrete contadas em memória (schema sem coluna; teto natural = 2h
antes); `sendText` sem retry (reenvio duplicaria); `bot-api-gaps` "cancelar fora do prazo" falha
entre ~22:30 e 00:00 UTC (startsAt +90min cruza meia-noite, expediente 00:00-23:59) — flake de
horário do teste, não do produto.
