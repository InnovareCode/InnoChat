---
name: plan-max-whatsapp-numbers-not-nullable
description: Plan.maxWhatsappNumbers é Int (não Int?) no schema — só maxProfessionals e os *Override de Tenant aceitam null = ilimitado; usar número alto em fixtures de teste, não null
metadata:
  type: project
---

`prisma/schema.prisma`, `model Plan`: `maxWhatsappNumbers Int` (obrigatório) mas
`maxProfessionals Int?` (nullable = ilimitado). Comentário no schema explica: "os 3 planos
aprovados nunca têm WhatsApp ilimitado, por isso não é nullable — só `maxProfessionals`
precisa do `null`". `Tenant.maxWhatsappNumbersOverride`/`maxProfessionalsOverride` (ambos `Int?`)
continuam nullable — "ilimitado" para números de WhatsApp só existe via override do admin da
plataforma, nunca via `Plan` direto.

**Pegadinha em teste:** um helper `createPlan(maxWhatsappNumbers: number | null)` genérico
(copiado de um padrão usado para `maxProfessionals` em outro arquivo de teste) quebra o
`tsc --noEmit` com `Type 'number | null' is not assignable to type 'number'` assim que você tenta
criar um `Plan` de fixture com `null`. Use um valor alto (ex.: `100`) como "sem limite prático"
para números de WhatsApp em fixtures, e reserve `null` só para `maxProfessionals`.

Relevante para: [[plan-limits]] (`src/modules/billing/plan-limits.ts#assertCanAddWhatsappNumber`),
qualquer teste de integração novo que crie `Plan` (`tests/integration/*.integration.test.ts`).
