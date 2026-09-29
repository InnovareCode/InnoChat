---
name: raw-sql-only-in-lib-db
description: Onde colocar uma query $queryRaw/Prisma.sql que precisa filtrar/ordenar por agregação (ex. estatísticas de Contact) sem N+1 nem carregar tudo em memória
metadata:
  type: project
---

Precisa de agregação (COUNT/MAX/MIN por linha) para FILTRAR e ORDENAR no banco (não em memória) e
o `include` nativo do Prisma não dá (não filtra por resultado de agregação, só inclui)? Escreva a
query com `$queryRaw` + `Prisma.sql`/`Prisma.join` — mas o arquivo que faz isso PRECISA morar
dentro de `src/lib/db/` (ex.: `src/lib/db/contact-queries.ts`), porque só lá o ESLint permite
importar `@prisma/client` cru (`eslint.config.mjs`, regra de arquitetura "app → modules → core").

Padrão usado (`src/lib/db/contact-queries.ts`, Fase 8 — clientes): `LEFT JOIN LATERAL` para as
agregações por linha, `tenantId` sempre interpolado via `${tenantId}` dentro do tagged template
(nunca concatenação de string — o Prisma parametriza tudo que passa por `${}`), `WHERE` e `ORDER
BY` dinâmicos montados com `Prisma.sql`/`Prisma.empty` conforme os filtros pedidos. O módulo de
domínio (`src/modules/contacts/contacts.ts`) só chama a função exportada, nunca monta SQL.

`COUNT(*)` do Postgres via `$queryRaw` vem como `BigInt` se não for casteado — sempre `::int` na
query quando o valor cabe em `number` normal do JS (evita `BigInt` vazando pro resto do código,
que quebraria `JSON.stringify`/serialização de Server Action sem tratamento especial).
