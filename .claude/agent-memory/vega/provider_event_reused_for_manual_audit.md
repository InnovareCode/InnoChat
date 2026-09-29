---
name: provider-event-reused-for-manual-audit
description: Como registrei a auditoria de "marcar fatura como paga manualmente" sem criar tabela nova — reaproveitando ProviderEvent(provider="manual")
metadata:
  type: project
---

`markInvoicePaidManually` (`src/modules/billing/admin-service.ts`, Admin Cobrança) precisava de
quem/quando/por quê registrado, mas o projeto não tinha tabela de auditoria genérica. Em vez de
criar uma (migration nova, mais um model), reaproveitei `ProviderEvent` — já existe para
idempotência de webhook (`provider`, `providerEventId`, `payload: Json`, `processedAt`) e o
shape serve igualmente bem para "evento administrativo pontual":

- `provider = "manual"`, `providerEventId = invoiceId` (uma fatura só pode ser marcada manual
  UMA vez — depois disso ela já está `PAID`; se reabrir um novo ciclo, é uma `Invoice` NOVA com
  outro id, então não colide).
- `payload = { invoiceId, adminId, reason, markedAt }` — quem, quando (também em `createdAt` da
  linha), por quê.
- A constraint `@@unique([provider, providerEventId])` faz o trabalho de "idempotência de
  auditoria" de graça: dois disparos concorrentes da mesma marcação nunca duplicam o registro
  (e o `applyInvoicePayment` por dentro já é idempotente por si, então a fatura também não
  avança o ciclo duas vezes).

**Por quê não um campo novo em `Invoice`:** exigiria migration em uma tabela "de negócio"
grande, para um evento que só acontece raramente (baixa manual) — `ProviderEvent` já é o lugar
"eventos administrativos avulsos" do sistema. Se um dia precisar de auditoria genérica de MUITAS
ações do admin (não só pagamento manual), aí sim vale um model `AuditLog` de propósito.

Ver [[invoice_idempotent_create_skips_pix_attach]] para o padrão irmão (idempotência de
criação de fatura).
