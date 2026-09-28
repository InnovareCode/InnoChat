---
name: prisma-transaction-aborts-after-p2002
description: Depois de um P2002 (unique violation) dentro de um $transaction interativo do Prisma, a transação Postgres inteira fica "aborted" — nenhuma query de recuperação pode continuar no MESMO tx, precisa de uma conexão/transação nova
metadata:
  type: project
---

Achado ao corrigir a corrida do webhook do Mercado Pago (revisão de segurança 2026-09-28,
`src/modules/billing/webhook.ts`): minha primeira tentativa de correção fazia, dentro do MESMO
`prisma.$transaction(async (tx) => {...})`, um `catch` no `tx.providerEvent.create()` que
capturava o P2002 e então tentava `tx.providerEvent.findUniqueOrThrow(...)` (mesmo `tx`) para
decidir o resultado.

**Isso está errado e teria quebrado em runtime contra Postgres real** (só não quebrou porque eu
percebi antes de rodar — mas quase escapou): depois que UMA query falha dentro de uma transação
SQL (violação de constraint incluída), o Postgres marca a transação inteira como "aborted" —
QUALQUER comando seguinte na mesma transação falha com `current transaction is aborted, commands
ignored until end of transaction block`, a menos que se use `SAVEPOINT`/`ROLLBACK TO SAVEPOINT`
explicitamente. O Prisma NÃO cria savepoint automático por query dentro de `$transaction`.

**Padrão correto, já usado em `claim.ts`/`connection.ts`/`recordSimpleIgnore`**: a query de
recuperação depois de um `catch (isUniqueViolation)` SEMPRE usa uma chamada NOVA a
`getPrisma()`/`prisma` de nível superior (nova transação implícita), nunca continua no `tx` que
acabou de falhar. Se a lógica original nem precisava de atomicidade real entre o
`findUnique`+`create` (a constraint única já É a fonte de atomicidade), o mais simples é nem usar
`$transaction` para isso — foi o que fiz em `webhook.ts` (removi o `$transaction`, ficou
`findUnique` → `create` → `catch(P2002)` → `findUniqueOrThrow` de recuperação, tudo com
`prisma` direto, auto-commit por statement).

Ver também [[prisma_exclude_violation_shape]] (como detectar o P2002) e
[[chatsession_lease_atomic_update]] (outro padrão de concorrência do projeto).
