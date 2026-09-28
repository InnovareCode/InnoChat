---
name: zod-tojsonschema-date-coerce-crash
description: z.toJSONSchema() (zod v4) lança em qualquer z.coerce.date() sem a opção unrepresentable — precisa dela para gerar OpenAPI sem trocar de biblioteca
metadata:
  type: reference
---

`z.toJSONSchema(schema, { target: "openapi-3.0" })` (zod v4.5, nativo — sem dependência de
`zod-to-openapi`) **lança** `Error: Date cannot be represented in JSON Schema` para qualquer
`z.coerce.date()` no schema (usado em `startsAt` nos contratos da API interna,
`src/lib/api-internal/schemas.ts`, InnoChat Fase 4).

**Correção:** passar `{ target: "openapi-3.0", unrepresentable: "any" }` — os campos de data
viram `{}` (qualquer tipo) no JSON Schema gerado em vez de lançar. Documentar o formato
esperado (ISO 8601) via `.describe(...)` no próprio campo zod, já que o schema gerado não
carrega mais essa informação de tipo.

**Como aplicar:** `scripts/generate-openapi.mjs` (InnoChat) já usa essa opção. Qualquer novo
schema zod com `z.coerce.date()`/`z.date()` que precise virar OpenAPI/JSON Schema precisa da
mesma flag — sem ela, o gerador quebra em runtime, não é aviso.
