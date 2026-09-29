---
name: chat-history-and-admin-notifications
description: Histórico de conversas (ChatMessage) grava a saída pelo PUT /sessions (sem mudar n8n); central de notificações do admin derivada; armadilhas de edição/teste
metadata:
  type: project
---

Histórico de conversas (2026-09-29): INBOUND gravado no `claim` (logo após a trava, antes de BOT_PAUSED/HUMAN_MODE...), OUTBOUND do bot no `updateSession` (PUT /sessions já recebe `outbound[]` e roda ANTES do envio e do desvio sandbox), `fromMe` não-eco vira OUTBOUND. **Why:** zero mudança no n8n e LOCK_LOST naturalmente não grava. **How to apply:** `/sandbox/outbox` NÃO deve gravar (duplicaria). Ao mudar o n8n para salvar a sessão DEPOIS do envio, o desenho continua válido mas a semântica "saiu de fato" melhora.

Admin notifications: derivadas, `TENANT_SUSPENDED` usa `currentPeriodEnd + GRACE_DAYS` porque não há coluna de suspensão; `TICK_LATE` fora da janela de 30 dias. Testes usam ids específicos (banco de teste é compartilhado), nunca totais.

Armadilhas: (1) heredoc bash com `<<'EOF'` contendo `python -` + vários blocos executou PARCIALMENTE e dobrou edições ao repetir — usar Write/Edit ou script .py em arquivo e conferir com grep -c antes de reexecutar. (2) Texto jurídico em TS: `\"` dentro de python virou `"` e quebrou a string — evitar aspas em texto legal. (3) `bot-api-gaps` "cancelar fora do prazo" falha depois das ~21h UTC (teste dependente de horário, não é regressão). (4) Guard real do painel devolve `UNAUTHENTICATED` (não UNAUTHORIZED) sem sessão; testes mockam `@/lib/auth` (`auth()`), não o guard.
