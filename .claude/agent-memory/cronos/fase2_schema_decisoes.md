---
name: fase2-schema-decisoes
description: Migration 20260930400000 (fase 2) - índice do lembrete, dedup de ChatMessage, enum REMINDER espelhado em texts.ts
metadata:
  type: project
---

- Índice `appointments(status, reminderSentAt, startsAt)`: igualdade em status, IS NULL em reminderSentAt, range em startsAt = ordem ideal para o job. Partial index seria menor mas o Prisma não expressa (drift no diff).
- `ChatMessage` unique `(tenantId, providerMessageId)`; nulos múltiplos ok. Está em TENANT_SCOPED_MODELS.
- Novo valor de `BotTextKey` exige também: `BOT_TEXT_KEYS` + `DEFAULT_BOT_TEXTS` em `src/core/bot/texts.ts` e `KEY_DESCRIPTION` em mensagens-bot-client.tsx (senão typecheck quebra).
- `prisma generate` deu EPERM (dll presa), mas o client/tipos saem atualizados.
