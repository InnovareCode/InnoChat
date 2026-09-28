---
name: prisma-client-stale-after-migration
description: npm run dev com Prisma Client desatualizado em relação a uma migration já aplicada faz Server Actions que tocam o campo novo devolverem 500 disfarçado de bug de UI
metadata:
  type: project
---

Durante o E2E de "Admin → Configurações → salvar chave da Evolution", a tela parecia ter um bug
de UI (campo não limpava, hint mascarado não atualizava depois de salvar). Investigação com
`page.on("console")`/`page.on("pageerror")` revelou a causa real:

```
Unknown field `publicBaseUrl` for select statement on model `PlatformSettings`.
```

A migration `20260928000007_platform_public_url_install_n8n` (Vega/Cronos, mesma sessão) já
tinha sido aplicada no Postgres (`npx prisma migrate status` confirmava "up to date"), mas o
`npm run dev` que eu tinha deixado rodando desde o início da sessão carregou o Prisma Client
ANTES da migration — e ninguém rodou `npx prisma generate` depois. `src/modules/platform/
service.ts` já usava `publicBaseUrl` no `select`, e o Client gerado não conhecia o campo — toda
chamada de `getPlatformSettings`/`updatePlatformSettingsAction` 500ava silenciosamente (o erro só
aparece no console do navegador, não na resposta visível da Server Action).

**Como aplicar:** depois de qualquer `prisma migrate dev`/`deploy` que rode em paralelo a uma
sessão com `npm run dev` já ativo, rodar `npx prisma generate` E reiniciar o servidor dev — nunca
assumir que "migration aplicada" implica "client atualizado". No Windows, `prisma generate` falha
com `EPERM` se o dev server ainda tiver o `query_engine-windows.dll.node` carregado — precisa
matar o processo Node antes.

Resolvido rodando `npx prisma generate` (não é código de produto — é regenerar artefato a partir
do schema já commitado) e reiniciando `npm run dev`. Depois disso os testes de
`tests/e2e/admin-secrets.spec.ts` passaram sem nenhuma mudança de asserção.
