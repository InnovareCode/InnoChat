---
name: mercadopago-no-fake-server
description: Por que "Gerar Pix agora" não pode ser testado com um servidor HTTP fake local, diferente de Evolution/n8n — e onde cada cenário (MISSING_DOCUMENT, RATE_LIMITED) acabou sendo coberto
metadata:
  type: project
---

`src/modules/billing/mercadopago.ts` tem `API_BASE = "https://api.mercadopago.com"` como
constante fixa — sem campo equivalente a `n8nBaseUrl`/base da Evolution em `PlatformSettings`
(`prisma/schema.prisma` só tem `mercadoPagoAccessToken`/`mercadoPagoWebhookSecret`, nada de URL).
`createMercadoPagoGateway(accessToken)` não recebe base URL. Diferente de Evolution/n8n, **não dá
para apontar o Mercado Pago para um servidor HTTP fake local sem alterar código de produto**.

A única porta de injeção que o produto expõe é `gateway?: MercadoPagoGateway` nas funções de
serviço (`regeneratePixForInvoice`, `tryAttachPix`, `regeneratePixForInvoiceAdmin`) — usada pelos
testes de INTEGRAÇÃO (`tests/integration/*.ts`, via `createMockMercadoPagoGateway` em
`mercadopago.mock.ts`). As Server Actions que a UI chama
(`regenerateMyInvoicePixAction`/admin) NÃO passam gateway — sempre resolvem o real
(`getMercadoPagoGateway()`). Ou seja: da tela pra baixo, é sempre o MP de verdade ou nada.

**Como cada cenário pedido acabou coberto:**
- `RATE_LIMITED`: testável de ponta a ponta pelo navegador
  (`tests/e2e/assinatura-pix.spec.ts`) — o teto (`checkRateLimit`, 5 tentativas/10min por tenant,
  `src/modules/billing/actions.ts`) é checado ANTES de resolver fatura/gateway, então independe
  de o Mercado Pago estar configurado ou não neste ambiente (não está — `PlatformSettings`
  tem os dois campos de MP `null` em dev).
- `MERCADOPAGO_MISSING_DOCUMENT`: só testável no nível de integração
  (`tests/integration/billing-admin.integration.test.ts`, injeta `createMockMercadoPagoGateway()`
  direto em `regeneratePixForInvoiceAdmin`) — não alcançável pela UI neste ambiente porque, sem
  token do MP configurado, o primeiro clique já falha com `MERCADOPAGO_NOT_CONFIGURED` antes de
  chegar no check de documento.

**Recomendação para a próxima rodada (Vega/Cronos):** adicionar um `mercadoPagoBaseUrl` opcional
em `PlatformSettings` (default `https://api.mercadopago.com`, como já existe para n8n) daria ao
MP a mesma paridade de teste E2E que Evolution/n8n já têm — vale a pena para não deixar essa
lacuna permanente.
