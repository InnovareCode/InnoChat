---
name: mercadopago-signature-go-sdk-spec
description: Regras exatas da assinatura de webhook do Mercado Pago (x-signature), conferidas contra o SDK oficial em Go — origem do data.id, omissão de pares ausentes, tolerância de replay
metadata:
  type: project
---

`verifyMercadoPagoSignature` (`src/modules/billing/mercadopago.ts`) foi implementada de memória
numa rodada anterior e batia com a doc em texto, mas tinha 2 desvios reais só visíveis
conferindo contra o SDK oficial (`github.com/mercadopago/sdk-go/pkg/webhook`,
`ValidateSignature`, conferido pelo Atlas em 2026-09-28):

1. **`data.id` vem do QUERY PARAM da notificação, não do corpo.** O corpo do webhook pode nem
   ter `data.id`, ou pode ter um valor diferente do que o MP realmente assinou — a assinatura é
   sobre o que veio na URL. Corrigido em `src/app/api/webhooks/mercadopago/route.ts`: prioriza
   `url.searchParams.get("data.id")`/`"id"`, só cai pro corpo como fallback.
2. **Cada par ausente (`id`/`request-id`) é OMITIDO do manifest, nunca causa rejeição
   isolada.** A versão anterior fazia `if (!dataId || !xRequestId) return false` ANTES de montar
   o manifest — errado. O certo: monta o manifest só com os pares presentes
   (`id:...;request-id:...;ts:...;`, nessa ordem, cada um opcional exceto `ts`), e deixa a
   comparação HMAC decidir.

`dataId.toLowerCase()` já estava certo desde a versão anterior (não era desvio).

Também adicionei tolerância de 10 min no `ts` (via parâmetro `now?: Date` opcional, só para
teste) — sem isso, um `x-signature` capturado nunca expirava por si só (o `ts` está DENTRO do
HMAC, mas nada comparava contra o relógio atual).

**Lição geral**: para specs de webhook de terceiro (assinatura, formato de payload), sempre que
possível confira contra o SDK oficial (código, não só a doc em prosa) — a doc em texto pode
omitir detalhes de borda (omissão de campo, origem exata do valor) que só aparecem na
implementação de referência. Ver também [[n8n_public_api_activate_deprecated_credentials_patch]]
para o mesmo padrão de "conferir contra o repo oficial, não só a doc".
