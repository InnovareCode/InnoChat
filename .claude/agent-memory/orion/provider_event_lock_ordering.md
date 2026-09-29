---
name: provider_event_lock_ordering
description: Padrão de idempotência via ProviderEvent só é seguro contra corrida se o registro de auditoria for criado ANTES de aplicar o efeito — achado MÉDIA 2026-09-29 em markInvoicePaidManually
metadata:
  type: project
---

O InnoChat usa `ProviderEvent(provider, providerEventId)` (constraint única) como trava de
idempotência/auditoria em mais de um fluxo de cobrança (`src/modules/billing/webhook.ts`,
`src/modules/billing/admin-service.ts#markInvoicePaidManually`). O padrão SÓ é seguro contra
corrida (duplo clique, duas abas, retry) quando o registro em `ProviderEvent` é criado/tentado
**ANTES** de chamar `applyInvoicePayment` — é o que `webhook.ts` faz (cria o evento, trata
`isUniqueViolation` como "já em processamento", só então aplica o pagamento).

`markInvoicePaidManually` (`admin-service.ts`, achado da revisão de 2026-09-29,
`docs/seguranca/revisao-incremental-2026-09-29.md`) inverteu a ordem: chama
`applyInvoicePayment` primeiro e só cria o `ProviderEvent(provider="manual")` depois. A checagem
`invoice.status === "PAID"` dentro da transação de `applyInvoicePayment` não é suficiente sozinha
(SELECT sem lock antes do UPDATE, isolamento READ COMMITTED do Postgres) — duas chamadas quase
simultâneas podem ambas passar a checagem e aplicar o pagamento duas vezes (soma 2 meses ao
período por 1 pagamento). Não corrigi (só leitura); proposta: inverter a ordem igual ao webhook,
ou trocar o SELECT+UPDATE por um `updateMany({ where: { status: "OPEN" } })` condicional.

**Ao revisar qualquer ação nova que reutilize `ProviderEvent` como trava de idempotência:**
confirmar que a criação do registro (ou a tentativa + tratamento de `isUniqueViolation`) acontece
ANTES de qualquer efeito que não seja ele mesmo idempotente por natureza.

Ver também [[csv_injection_pushname]].
