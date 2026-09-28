---
name: chatsession-lease-atomic-updatemany
description: Como adquirir a trava (lease de 20s) da ChatSession de forma atômica sem SELECT FOR UPDATE — updateMany condicional + checar count
metadata:
  type: project
---

`src/modules/bot-api/claim.ts` (InnoChat, Fase 4) adquire a trava de 20s da `ChatSession`
(docs/arquitetura.md §2 regra 2) com um único `prisma.chatSession.updateMany({ where: { id,
OR: [{ lockToken: null }, { lockedUntil: { lt: now } }] }, data: { lockToken, lockedUntil } })`
e checa `result.count === 0` para decidir `busy`. **Não precisa de `SELECT ... FOR UPDATE`
nem de transação explícita**: um `UPDATE` isolado já é atômico no Postgres — duas execuções
concorrentes desse `updateMany` na mesma linha serializam (a segunda só reavalia o `WHERE`
depois que a primeira comita), então no máximo uma pega `count === 1`.

**Por quê importa:** é o mesmo padrão de "optimistic lease" já usado no `version`/`lockToken`
do `PUT /sessions/{id}` — testado sob concorrência real em
`tests/integration/bot-api.integration.test.ts` ("claim concorrente do mesmo contato: uma
execução recebe busy").

**Como aplicar:** qualquer trava por prazo futura (não só `ChatSession`) pode reusar esse
padrão: `updateMany` com a condição de "livre" no `WHERE`, nunca um `findFirst` seguido de
`update` separado (isso teria uma janela de corrida entre o `read` e o `write`).

Ver também [[prisma-exclude-violation-shape]] (mesmo arquivo, `isUniqueViolation` para
detectar `P2002` por assinatura ao invés de `.code` tipado).
