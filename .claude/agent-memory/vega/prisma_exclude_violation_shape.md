---
name: prisma-exclude-violation-shape
description: Como detectar em runtime uma violação da constraint EXCLUDE (SQLSTATE 23P01) do Postgres via Prisma — o Prisma não dá um error.code próprio para isso
metadata:
  type: project
---

Confirmado empiricamente contra Postgres real (InnoChat, Fase 2, constraint
`appointments_no_overlap_per_professional`): quando um `create()`/`update()` do Prisma Client
viola uma constraint `EXCLUDE USING gist` do Postgres, o erro lançado é um
`PrismaClientUnknownRequestError` — **não** um `PrismaClientKnownRequestError` com `.code`
(tipo `P2002` de unique constraint). `.code` e `.meta` vêm `undefined`; o SQLSTATE `23P01` e o
texto "restrição de exclusão"/"exclusion" só aparecem dentro de `.message`.

**Por quê:** o Prisma só mapeia um conjunto fechado de SQLSTATEs conhecidos (unique, FK, etc.)
para os `PxxYY` documentados. `23P01` (exclusion_violation) não está nesse mapa, então cai no
genérico `PrismaClientUnknownRequestError`.

**Como aplicar:** para detectar a violação em código (ex.: mapear para o erro de domínio
`SLOT_TAKEN`), checar por assinatura: `error.constructor?.name ===
"PrismaClientUnknownRequestError" && error.message.includes("23P01")` — nunca `instanceof` de
`@prisma/client` fora de `src/lib/db/` (proibido pelo ESLint). Ver
`isExclusionViolation()` em `src/modules/agenda/appointments.ts`. Se uma versão futura do
Prisma passar a reconhecer `23P01` com um `code` dedicado, simplificar essa checagem — testar
de novo contra o banco real antes de confiar em `.code`.

Ver também [[forTenant-so-cobre-tenantid-direto]].
