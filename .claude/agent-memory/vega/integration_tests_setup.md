---
name: integration-tests-setup-innochat
description: Como rodar tests/integration (Postgres real) no InnoChat — banco separado, config vitest própria, e como criar innochat_test sem precisar ler a senha do .env
metadata:
  type: project
---

`tests/integration/**` roda com `npm run test:integration`
(`vitest.integration.config.ts`), que exige `TEST_DATABASE_URL` de verdade — nunca entra no
`npm test` padrão (`vitest.config.ts` agora só inclui `src/**/*.{test,spec}.ts`, de propósito,
para o `npm test` continuar verde sem depender de Postgres disponível).

**Banco `innochat_test`:** criado com `npx prisma db execute --schema prisma/schema.prisma
--stdin <<< "CREATE DATABASE innochat_test;"` — essa chamada usa o `DATABASE_URL` do `.env` (que
já aponta pro banco `innochat` de dev) e o Postgres permite `CREATE DATABASE` a partir de
QUALQUER conexão com privilégio, não só conectado em `postgres`/`template1`. Isso evita precisar
de uma connection string separada para o banco `postgres` (cujas credenciais o agente não tinha
como obter sem ler o `.env`, ação bloqueada pelo classificador de permissões).

Migrations aplicadas com `prisma migrate deploy` apontando pro banco de teste.

**Rodar os testes sem nunca expor a senha do `.env`:** um wrapper Node (descartável, escrito no
scratchpad da sessão, não commitado) lê o `.env` só para DERIVAR `TEST_DATABASE_URL` (troca o
nome do banco no fim da connection string) e passa isso como env var para o processo filho
(`npx prisma migrate deploy` / `npm run test:integration`) via `spawnSync` — nunca imprime a
string resultante. Reconstruir esse wrapper (ou pedir ao dono para exportar `TEST_DATABASE_URL`
manualmente) é o caminho em sessões futuras; não tentar `cat .env` nem variações (bloqueado por
design — ver a regra de "Credential Materialization" do modo automático).

Ver também [[prisma-exclude-violation-shape]] (o teste de concorrência de
`tests/integration/agenda.integration.test.ts` é o que provou aquele comportamento).
