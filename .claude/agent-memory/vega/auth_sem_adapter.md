---
name: authjs-sem-prisma-adapter
description: InnoChat não usa PrismaAdapter no Auth.js v5 — schema não tem Account/Session/VerificationToken (só Credentials + JWT na v1)
metadata:
  type: project
---

`src/lib/auth.ts` (InnoChat) configura Auth.js v5 **sem** `PrismaAdapter`.

**Por quê:** o schema do Cronos (`prisma/schema.prisma`, Fase 1) não modela
`Account`/`Session`/`VerificationToken` — os models que o adapter padrão do
Auth.js exige para funcionar. Não há provider OAuth na v1 (só Credentials
e-mail/senha) e a sessão é JWT (sem sessão em banco), então o adapter não
tinha função nenhuma além de forçar esses três models a existir. Diferente do
InnoAtendente, que mantinha `PrismaAdapter(rawPrisma)` "de prontidão" para um
OAuth futuro — aqui a decisão foi não pagar esse custo de acoplamento sem uso
real.

**Como aplicar:** se um provider OAuth entrar pós-v1 (roadmap não fala
nisso), é nesse momento que se decide entre (a) adicionar
`Account`/`Session`/`VerificationToken` ao schema e plugar `PrismaAdapter`, ou
(b) fazer o linking de conta manualmente em `src/modules/auth/service.ts`,
como já é feito para Credentials. Não reintroduzir o adapter só por hábito.

`AuthorizedUser.name` sempre `null`: o model `User` não tem campo de nome de
exibição (é global/não tenant-scoped — nome de exibição, se existir, tende a
morar em `Membership`/`Tenant`).
