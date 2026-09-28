---
name: prisma-singleton-function
description: getPrisma() precisa ser função (nunca Proxy) — convenção do InnoChat/InnoAtendente para o singleton do Prisma Client
metadata:
  type: feedback
---

O singleton do Prisma Client (`src/lib/db/prisma.ts`) é sempre uma **função**
(`export function getPrisma(): PrismaClient { ... }`), guardando a instância
em `globalThis` para sobreviver ao hot-reload do `next dev`. Nunca embrulhar
o client em `new Proxy(...)`.

**Por quê:** Proxy que intercepta `get`/`apply` para recriar ou revalidar o
alvo a cada acesso quebra clients stateful — o PrismaClient mantém conexão e
estado interno por instância (transações, `$extends`, pool de conexão), e o
Proxy perde essa identidade. Causou um bug real no InnoAtendente.

**Como aplicar:** em todo projeto novo com Prisma (InnoChat, e qualquer
outro), escrever `getPrisma()` como função simples desde o início — não
"otimizar" com Proxy achando que é mais elegante. `forTenant(tenantId)`
(client escopado por tenant via `$extends`) chama `getPrisma()` internamente
e nunca cacheia a extensão fora da chamada.

Ver também [[forTenant-so-cobre-tenantid-direto]].
