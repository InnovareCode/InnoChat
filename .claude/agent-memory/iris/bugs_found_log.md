---
name: bugs-found-log-2026-09-28
description: Registro de bugs/gaps encontrados na rodada de 2026-09-28 (missão cmulog9q4036701lfwxhtzce8) — para o ciclo de mitigação, o que verificar de novo na próxima rodada
metadata:
  type: project
---

Rodada: E2E Playwright (Fase 1/2) + lacunas de integração da API do bot (Fase 4) + investigação
de flaky em `bot-api.integration.test.ts`.

1. **Prisma Client desatualizado após migration** (`publicBaseUrl`) — causava 500 silencioso em
   `admin/configuracoes`. Não era bug de produto (schema/migration corretos), era ambiente de dev
   sem `prisma generate` depois da migration. Ver [[prisma_client_stale_after_migration]]. Corrigido
   nesta sessão (regenerei o client — não é `src/`).
2. **Gap de produto, não bug**: não existe tela no painel para criar bloqueio/feriado da EMPRESA
   INTEIRA (`professionalId: null`) — só o detalhe do profissional tem "Novo bloqueio", sempre
   escopado a ele. A Server Action já aceita `professionalId: null` e a Agenda já sabe renderizar
   (testado criando a exceção direto no banco). PARA O PRÓXIMO: Lyra precisa decidir onde esse
   controle mora na UI (Configurações? Uma tela "Bloqueios e feriados" própria, como o
   `docs/arquitetura.md §9` já prevê e ainda não foi construída).
3. **Flaky de `bot-api.integration.test.ts`** (20 reservas paralelas, visto pela Vega uma vez com
   0 sucessos): NÃO reproduzido em 5 rodadas completas da suíte de integração nesta sessão (nem
   isolado, nem full suite, antes E depois de `prisma generate`). Não há `connection_limit`
   explícito na `DATABASE_URL`/`PrismaClient` (`src/lib/db/prisma.ts`) — hipótese mais provável é
   exaustão/latência do pool de conexão do Postgres sob carga do host, não bug de isolamento ou
   lógica de negócio (a constraint `EXCLUDE` é a garantia real, testada e couberta). Se voltar a
   acontecer, próximo passo é capturar o erro exato das 20 promises rejeitadas (não só contar
   sucesso) para confirmar se é `SLOT_TAKEN` genuíno ou erro de conexão disfarçado.

Nenhum bug de lógica de negócio/segurança encontrado nesta rodada além do item 1 (ambiente, já
corrigido). Isolamento entre tenants, `SLOT_TAKEN`, `TOO_LATE`, `TENANT_SUSPENDED`, mascaramento
de segredos — todos verificados e corretos.
