---
name: invoice-idempotent-create-skips-pix-attach
description: createInvoiceForPeriod (billing) faz no-op se a fatura já existe — nunca chamar isso para anexar Pix numa fatura que você MESMO acabou de criar em outro passo (ex.: dentro de uma transação); use tryAttachPix direto
metadata:
  type: project
---

`src/modules/billing/service.ts`: `createInvoiceForPeriod`/`createInvoiceForPeriodTracked`
checam `(subscriptionId, periodStart)` antes de criar — se já existe uma fatura para aquele
período, devolvem a fatura EXISTENTE sem chamar o Mercado Pago. Isso é o que garante que o
`billing/tick` rodando 2x não duplica fatura nem gera Pix 2x para o mesmo ciclo.

**Bug real** (`src/modules/signup/service.ts`, `signUp`): a fatura do trial nasce DENTRO da
transação do cadastro (`tx.invoice.create`, sem Pix — chamada de rede não entra em transação de
banco). Depois da transação, o código original chamava `createInvoiceForPeriod({ ...mesmos
subscriptionId/periodStart... })` esperando que isso completasse o Pix — mas como a fatura JÁ
EXISTIA (acabara de ser criada), a função batia no check de idempotência e devolvia a fatura sem
Pix, sem nunca chamar `tryAttachPix`. `invoice.pixCopyPaste` ficava sempre `null`, mesmo com um
gateway mock funcionando perfeitamente — só apareceu porque o teste de integração
(`tests/integration/billing-signup.integration.test.ts`) afirmava `pixCopyPaste` truthy.

**Correção**: exportar `tryAttachPix(invoiceId, payerEmail, description, gateway?)` de
`service.ts` e chamar ISSO direto quando você já tem o `id` da fatura recém-criada — nunca passar
pelo wrapper idempotente nesse caso. O wrapper idempotente (`createInvoiceForPeriodTracked`) é só
para quem NÃO sabe se a fatura já existe (o caso do `billing/tick`, que decide criar ou não).

**Como evitar recorrência**: qualquer função "criar-ou-reaproveitar" (idempotente por unique
constraint) que faça efeito colateral (Pix, e-mail) só nesse "criar" precisa deixar claro no
nome/doc que o efeito colateral SÓ roda no caminho de criação — e quem já tem o registro criado
por outro caminho deve chamar a etapa de efeito colateral diretamente, não a função "criar-ou-
reaproveitar" inteira.
