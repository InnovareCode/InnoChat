---
name: timeline-error-masked-no-log-and-finish-actions
description: Bug "Não foi possível carregar o histórico" NÃO reproduziu no service/action com dados do bot; virou log+Result. Também: desenho de concluir/faltou/reabrir.
metadata:
  type: project
---

**Bug do histórico (2026-09-29):** reproduzi o cenário exato (agendamento do bot, evento CONTACT com authorId = id do contato, evento legado com tenantId NULL, action real com guard mockado) e a timeline carrega. Suspeitas descartadas por teste/leitura: authorId de contato (só USER consulta usuário), filtro por tenantId (a timeline filtra por appointmentId), Date na serialização (tudo vira ISO string), props do componente. A mensagem genérica só aparece no `.catch` do cliente = a action LANÇOU (runAction relança erro inesperado; ZodError/DomainError viriam com mensagem própria). Causa raiz em prod segue NÃO confirmada.

**Why:** erro inesperado virava tela de erro do Next sem nenhum log — impossível diagnosticar.

**How to apply:** `getAppointmentTimelineAction` agora captura, faz `logger.error("getAppointmentTimelineAction falhou", {appointmentId, errorName, errorCode, errorMessage})` e devolve `TIMELINE_UNAVAILABLE`. Olhar esse log em prod primeiro. Timeline agora usa `select` explícito nas colunas (não depende de `tenantId`). Regra geral: action de LEITURA consumida por `useEffect` deve logar + devolver Result, não relançar. Nota: `logger` redige a chave `message`; use `errorMessage`.

**Encerramento:** `finishAppointment`/`reopenAppointment` em src/modules/agenda/appointments.ts usam `updateMany` condicional (status + startsAt<=now no WHERE) na mesma transação do evento; count 0 → relê e decide o erro. Enum ganhou `REOPENED` (migration aditiva `ADD VALUE IF NOT EXISTS`); feed de notificações filtra `action != REOPENED`. Reabrir pode bater no EXCLUDE (só vale p/ SCHEDULED) → SLOT_TAKEN. Armadilha: `prisma generate` falha com EPERM na DLL se houver `next dev` rodando, mas o client JS/tipos já são gravados antes; apagar os `.tmp*` deixados.
