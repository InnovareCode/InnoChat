---
name: fase7-cobranca-decisoes
description: Decisões de modelagem da Fase 7 (Plan/Subscription/Invoice/ProviderEvent/TrialClaim) do InnoChat — por que cada FK/unique/index ficou como ficou
metadata:
  type: project
---

Schema em `prisma/schema.prisma`, seção "Fase 7". Decisões que não são óbvias só lendo o código:

1. **`Subscription.tenantId` é `@unique` (1:1 de verdade), não só indexado.** Uma linha só por
   tenant, para sempre — trocar de plano ou reativar depois de `CANCELED` reescreve a MESMA linha
   (`planId`/`pendingPlanId`/`status`), nunca cria uma segunda. Isso é o que faz "segunda
   assinatura ativa pro mesmo tenant" falhar na constraint do banco, não só na aplicação. Se um
   dia precisar de histórico de assinaturas (auditoria de troca de plano), isso é tabela nova
   (ex.: `SubscriptionChange`), não abrir mão deste unique.
2. **Overrides de limite (`maxWhatsappNumbersOverride`/`maxProfessionalsOverride`) ficam só no
   `Tenant`** (já existiam da Fase 1), não duplicados em `Subscription`. Uma fonte só evita "qual
   valor vale" quando os dois divergirem.
3. **`Invoice` não tem `tenantId` próprio** — só `subscriptionId`. Segue o mesmo padrão já usado em
   `AppointmentEvent`/`ChatSession`/`InboundEvent` (tenant-scoped por relação até o pai que tem
   `tenantId`, sem coluna própria). Isso é INTENCIONAL, não esquecimento.
4. **`TrialClaim.phoneE164` é único sozinho** (não composto com `tenantId`) porque a checagem
   anti-abuso (§7.3 regra 4) precisa ser CROSS-tenant: "esse número já teve trial em QUALQUER
   empresa". `TrialClaim.tenantId` existe só para saber quem consumiu o trial (auditoria/mensagem
   de erro), nunca para escopo de leitura.
5. **`Plan` nasce com `priceCents = 0` e `active = false`** (decisão registrada no comentário do
   model) porque o dono ainda não definiu preço em 2026-09-28. Em vez de chutar um valor
   provisório que alguém esquece de trocar, `active = false` torna estruturalmente impossível
   vender por engano a um preço errado — o plano só aparece no cadastro público quando o admin
   ativar. Ver PENDÊNCIAS no handoff da Fase 7 para cobrar isso do dono.
6. **Índices para `billing/tick`** (roda de hora em hora, §6.8): `Subscription(status,
   currentPeriodEnd)` para achar quem vai vencer/gerar fatura; `Subscription(status,
   trialEndsAt)` para fechar trial; `Invoice(status, dueAt)` e `Invoice(status, pixExpiresAt)`
   para lembrete/expiração de Pix. `Invoice(mpPaymentId)` é para o webhook do MP achar a fatura
   pelo id do pagamento antes de reconsultar a API (§6.10). Todos batem 1:1 com uma consulta
   descrita no fluxo, nenhum "por garantia".

**Não entraram em `TENANT_SCOPED_MODELS`** (`src/lib/db/tenant-scope.ts`, de propriedade da Vega —
Cronos não edita `src/`): `Plan` (global), `ProviderEvent` (global), `Invoice` (sem `tenantId`
próprio, ver item 3), `TrialClaim` (tem `tenantId` mas precisa ser lido cross-tenant, ver item 4).
**Só `Subscription` precisa entrar na lista** — tem `tenantId` próprio e é sempre lido/escrito no
escopo de um tenant. Isso foi passado no handoff pra Vega, não implementado aqui.

Ver também [[migrate_diff_sem_tty]] para como a migration desta fase foi gerada e aplicada.
