---
name: forTenant-so-cobre-tenantid-direto
description: forTenant()/scopeArgsToTenant só escopa automaticamente models com coluna tenantId própria — models filhos (via relação) precisam de scoping manual pelo pai
metadata:
  type: project
---

`src/lib/db/tenant-scope.ts` (InnoChat) injeta `tenantId` automaticamente só
nos models que têm **coluna `tenantId` própria** no schema:
`Membership`, `Service`, `Professional`, `ScheduleException`, `Contact`,
`Appointment`, `WhatsappInstance`, `BotText` (confirmado contra
`prisma/schema.prisma` do Cronos, Fase 1).

**Por quê:** vários models tenant-scoped do domínio NÃO têm `tenantId`
próprio — o isolamento é por relação até o pai que tem a coluna:
`ProfessionalService`/`WorkingHour` (via `professionalId` → `Professional`),
`AppointmentEvent` (via `appointmentId` → `Appointment`), `ChatSession`
(via `whatsappInstanceId` → `WhatsappInstance`), `InboundEvent` (idem).
Colocar esses na lista `TENANT_SCOPED_MODELS` faria o `$allOperations`
injetar `where: { tenantId }` num model sem essa coluna → erro do Prisma em
runtime ("Unknown argument tenantId"), só descoberto ao rodar contra o banco
de verdade.

**Como aplicar:** ao implementar qualquer service (Fases 2+) que toque um
desses models "filhos", carregar/validar o pai com `forTenant(tenantId)`
primeiro (ex.: `forTenant(tid).professional.findFirstOrThrow({ where: { id } })`)
e só então operar no filho — nunca filtrar o filho direto por um tenantId
que ele não tem. Se algum desses models ganhar coluna `tenantId` própria numa
migration futura do Cronos, adicionar à lista em `tenant-scope.ts` e ao teste
em `tenant-scope.test.ts`.

Ver também [[prisma-singleton-function]].
