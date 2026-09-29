---
name: prisma-upsert-race-and-echo-cas
description: upsert do Prisma não é atômico (P2002 na criação concorrente) + como o lembrete grava recentOutbound sem perder hash do bot; mensagens do Prisma vazam corpo nos logs
metadata:
  type: feedback
---

- `prisma.x.upsert` NÃO é atômico quando a linha não existe: dois concorrentes dão P2002 no create. Capturar `isUniqueViolation` e reler/tentar de novo. Achado pelo teste de concorrência de `registerOutboundEcho` (reminders/tick.ts).
- Append em `ChatSession.recentOutbound` fora do bot: `updateMany` condicionado a `updatedAt` lido + trava livre (compara com `new Date()` de parede, pois o claim grava lockedUntil com relógio real), retry curto; trava ativa => "busy" e o lembrete adia (devolve a reserva). Não usar `version` (o PUT do bot faz CAS nela).
- `error.message` do Prisma reproduz os ARGUMENTOS (corpo da mensagem do cliente). Em log usar `describeDbError` (src/lib/db/prisma-errors.ts): nome, code, meta.target.
- Rejeição 4xx da Evolution (exceto 408/429) = permanente: mantém `reminderSentAt`; rede/timeout/5xx = devolve reserva.
- fromMe para número sem Contact: claim devolve ignore(FROM_ME_ECHO) sem criar Contact/sessão (efeito colateral: dono que puxa conversa com lead novo não pausa o bot).
- Heredoc com python/`'''` + textos grandes no Bash às vezes falha o parse inteiro e nada é aplicado: usar Write/Edit para arquivos de teste.

**Why:** bugs/decisões da rodada de correções pré-deploy da Fase 2 (2026-09-29).
**How to apply:** ao mexer em lembrete, histórico de conversas ou sessão do bot.
