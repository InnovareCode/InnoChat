---
name: prisma-json-null-field
description: Como zerar um campo Json? (nullable) via Prisma — plain `null` no `data` dá erro de tipo do TypeScript
metadata:
  type: project
---

Um campo `Json?` no schema (ex.: `PlatformSettings.lastBillingTickResult`) NÃO aceita `null`
literal em `data: { campo: null }` — o TypeScript reclama `Type 'null' is not assignable to
type 'NullableJsonNullValueInput | InputJsonValue | undefined'`. É preciso usar o sentinel do
Prisma:

```ts
import { Prisma } from "@prisma/client";
await prisma.platformSettings.update({ where: { id: 1 }, data: { lastBillingTickResult: Prisma.JsonNull } });
```

`undefined` (campo omitido) mantém o valor atual, mas se o objetivo é gravar `NULL` de verdade
na coluna JSONB, é `Prisma.JsonNull`, não `null`. Achado escrevendo
`tests/integration/platform-legal-health.integration.test.ts` (Fase "Dados jurídicos/Admin
Saúde", 2026-09-29) — [[integration_tests_setup]].
