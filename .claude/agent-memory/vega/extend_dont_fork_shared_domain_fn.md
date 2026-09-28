---
name: extend-dont-fork-shared-domain-function
description: Ao reaproveitar uma função de domínio (createAppointmentManual etc.) para um segundo caller com necessidades diferentes (source/autor), adicionar parâmetros opcionais com default = comportamento antigo, nunca duplicar a função
metadata:
  type: feedback
---

Na Fase 4 do InnoChat, o bot (`src/modules/bot-api/booking-bot.ts`) precisava criar/cancelar/
remarcar `Appointment` com `source: "WHATSAPP"`, `authorType: "CONTACT"` e
`whatsappInstanceId` — só que `createAppointmentManual`/`cancelAppointment`/
`rescheduleAppointment` (`src/modules/agenda/appointments.ts`, Fase 2) já existiam com
`source: "PANEL"`/`authorType: "USER"` fixos.

**Decisão:** estender a assinatura dessas 3 funções com um último parâmetro/campo OPCIONAL
(`actorOptions?` / `authorType = "USER"`) cujo valor padrão reproduz EXATAMENTE o
comportamento antigo — nunca duplicar a função num módulo novo (`booking-bot.ts` teria
reimplementado idempotência + `EXCLUDE` + transação do zero, dobrando a superfície de bug).

**Por quê:** a garantia cara de reproduzir (idempotência por chave + por
contato/serviço/início, tratamento de `SLOT_TAKEN` via constraint `EXCLUDE`, transação com
`AppointmentEvent`) já estava testada em `tests/integration/agenda.integration.test.ts`.
Estender preserva essa cobertura para o novo caller de graça, e o teste antigo continua
passando sem alteração (prova de que o comportamento por omissão não mudou).

**Como aplicar:** ao precisar de uma função de domínio já existente só com "mais um campo
gravado" ou "autor diferente", primeiro tentar adicionar um parâmetro opcional com default
neutro, antes de escrever uma função paralela. Só forkar de verdade se a lógica de negócio em
si divergir (não só metadados de quem/como).
