---
name: plan-price-data-migration-never-overwrite-edit
description: Padrão para migration de DADOS (não schema) que aplica um valor de negócio aprovado pelo dono sem sobrescrever edição manual — usado para os preços dos 3 planos
metadata:
  type: project
---

Pedido: "aplicar os preços aprovados X/Y/Z nos planos essencial/profissional/clinica, sem nunca
sobrescrever um plano que o dono já editou pela tela Admin → Planos". `prisma/seed.ts` cria os 3
planos com `priceCents: 0, active: false` (estado "aprovado mas sem preço ainda") — e não roda em
produção. Solução: `prisma/migrations/20260928000010_plan_prices/migration.sql`, SQL puro (não
Prisma Migrate de schema):

1. `INSERT ... SELECT ... WHERE NOT EXISTS` — cria o plano pelo `code` se ele ainda não existir
   (produção nasce vazia).
2. `UPDATE ... WHERE code = ? AND priceCents = 0 AND active = false` — só toca planos que ainda
   estão no estado "recém-criado pelo seed, não precificado". Qualquer preço diferente de 0
   (mesmo se `active` ainda for `false`) significa que um humano já editou — a migration nunca
   toca.

Id do `INSERT` gerado com `md5(random()::text || clock_timestamp()::text || v.code)` — não precisa
ser um cuid de verdade (Prisma trata `id` como string opaca), só único; evita depender de
extensão `pgcrypto`/`uuid-ossp` que talvez não esteja habilitada no banco de produção.

`DOWN.sql` é best-effort: só reverte linhas que ainda estão EXATAMENTE no valor que o UP aplicou
(mesma cautela — nunca reverter por cima de uma edição humana feita depois).

Padrão geral: sempre que uma migration for aplicar um VALOR DE NEGÓCIO (preço, limite, texto
padrão) em vez de mudar o schema, a condição de "só aplica se ainda está no estado padrão de
fábrica" é o que protege contra sobrescrever uma decisão que o admin já tomou pela UI.
