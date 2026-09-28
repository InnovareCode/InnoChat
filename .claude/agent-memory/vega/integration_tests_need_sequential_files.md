---
name: integration-tests-need-sequential-files-for-global-scans
description: vitest.integration.config.ts precisa de fileParallelism:false — testes que fazem varredura global de tabela (billing/tick) colidem com o afterAll de outros arquivos de teste rodando em paralelo no MESMO Postgres
metadata:
  type: project
---

`tests/integration/**` roda tudo contra o MESMO banco `innochat_test` real
([[integration_tests_setup]]). Por padrão o Vitest roda arquivos de teste diferentes em paralelo
(workers/threads separados). Isso é seguro enquanto cada teste só toca as próprias linhas (tenant
criado com slug único, limpo no `afterAll` por id) — é o padrão usado em
`agenda.integration.test.ts` e `bot-api.integration.test.ts`.

`src/modules/billing/tick.ts` (`runBillingTick`) quebra essa premissa DE PROPÓSITO: em produção
ele precisa varrer TODAS as `Subscription`/`Invoice` não-canceladas, sem filtro de tenant (é
literalmente o trabalho do tick). Num teste de integração, isso significa que o tick de um
arquivo de teste (`billing-tick.integration.test.ts`) pode enxergar fixtures de OUTRO arquivo
(`billing-signup.integration.test.ts`, `billing-webhook.integration.test.ts`) que estão sendo
apagadas no `afterAll` dele no mesmo instante. O sintoma foi um erro real do Prisma:
`PrismaClientUnknownRequestError: Inconsistent query result: Field tenant is required to return
data, got null instead` — uma consulta com `include` em 2 etapas (fatura → assinatura → tenant)
viu a assinatura mas não achou mais o tenant, porque outro arquivo cascade-deletou o Tenant entre
as duas etapas.

**Correção**: `vitest.integration.config.ts` ganhou `fileParallelism: false` — arquivos de
`tests/integration/**` rodam em sequência, não em paralelo entre si. Testes DENTRO do mesmo
arquivo continuam podendo rodar em paralelo/concorrência real quando é isso que o teste quer
provar (ex.: 20 chamadas simultâneas dentro de UM teste, `agenda.integration.test.ts`/
`bot-api.integration.test.ts` — isso não muda, é orquestrado pelo próprio teste com
`Promise.allSettled`, não pelo scheduler de arquivos do Vitest).

**Como aplicar**: qualquer nova rotina de fundo (tick/cron/job) que faça varredura sem escopo de
tenant precisa ter seu teste de integração ciente de que roda no MESMO banco que os outros
arquivos — ou aceitar `fileParallelism: false` (já ligado), ou escopar a fixture do teste de um
jeito que sobreviva a cascatas de outros arquivos (não dá, para uma varredura global de verdade).

Ver também [[invoice_idempotent_create_skips_pix_attach]] (outro bug pego pela mesma bateria de
testes) e a nota "flaky" sobre `bot-api.integration.test.ts` no handoff da Fase 7 — parece
sensibilidade a timing/carga acumulada de conexões numa suíte grande, não um bug de isolamento.
