---
name: fortenant-create-needs-literal-tenantid
description: create() em um model tenant-scoped via forTenant() precisa de tenantId literal no data, mesmo a extension sobrescrevendo em runtime — senão o TypeScript não compila
metadata:
  type: feedback
---

`forTenant(tenantId).service.create({ data: {...} })` (e qualquer outro model de
`TENANT_SCOPED_MODELS`) — o TypeScript continua exigindo `tenantId` no tipo de `data`, porque a
`$extends` que injeta `tenantId` em runtime (`src/lib/db/tenant-scope.ts`) não muda a
assinatura estática do Prisma Client. Sem passar `tenantId` no `data`, `tsc --noEmit` falha com
"Property 'tenant' is missing".

**Por quê:** `$extends` é uma transformação em runtime; o gerador de tipos do Prisma não sabe
que aquela operação específica terá o campo preenchido de fora. É uma limitação conhecida de
Prisma Client Extensions, não um bug do `tenant-scope.ts`.

**Como aplicar:** em todo `create()`/`upsert().create` de um model tenant-scoped, passar
`{ ...input, tenantId }` no `data` — o valor é cosmético para o compilador; `scopeArgsToTenant`
SOBRESCREVE esse campo de qualquer forma antes de chegar ao banco (nunca confia no valor
passado). Comentar isso no código no ponto de uso (ver `createService`/`createProfessional` em
`src/modules/agenda/catalog.ts`) para quem ler não achar que o `tenantId` ali tem efeito real.

Ver também [[prisma-singleton-function]] e [[forTenant-so-cobre-tenantid-direto]].
