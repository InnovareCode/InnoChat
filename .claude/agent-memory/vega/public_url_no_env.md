---
name: public-url-no-env
description: Como o InnoChat descobre a URL pública do painel sem AUTH_URL/NEXT_PUBLIC_APP_URL em env var, e a armadilha do prerender estático em /instalacao
metadata:
  type: project
---

Decisão do dono (2026-09-28): nenhuma URL/credencial solta em env var — no Easypanel só sobram
`DATABASE_URL` e `AUTH_SECRET`. `src/lib/public-url.ts#getPublicBaseUrl()` substitui
`env.NEXT_PUBLIC_APP_URL` em todo lugar (links de e-mail, `billingUrlFor`, `painelUrl` enviado ao
n8n): deriva de `x-forwarded-proto`/`x-forwarded-host` da requisição atual; fora de uma
requisição (tick/cron), cai para `PlatformSettings.publicBaseUrl`, gravado sozinho na 1ª vez que
um admin salva Configurações (`ensurePublicBaseUrlFromCurrentRequest`, chamada dentro de
`updatePlatformSettingsAction`). `AUTH_URL`/`NEXT_PUBLIC_APP_URL` em `src/env.ts` ficaram
**opcionais** e sem leitura em runtime — reintroduzir `env.NEXT_PUBLIC_APP_URL` em código novo é
regressão.

**Armadilha real encontrada nesta sessão**: a página pública `/instalacao` (bootstrap do primeiro
admin, `src/modules/platform/install.ts`) não usa `headers()`/`cookies()` nem nada que force o
Next a tratá-la como dinâmica — sem `export const dynamic = "force-dynamic"`, o `next build` a
prerenderiza como **estática**, congelando o resultado de `hasPlatformAdmin()` do momento do
build (quase sempre "sem admin"). Em produção, a rota nunca reavaliaria e nunca viraria 404
depois da instalação — bug silencioso que só aparece rodando `next build` de verdade (`tsc`/lint
não pegam). Regra: **toda página pública que decide 200 vs 404/redirect com base em uma leitura
de banco feita no `page.tsx` do App Router precisa de `dynamic = "force-dynamic"` explícito**,
a menos que já use algo que force dinamismo sozinho (`headers()`, `cookies()`, Server Action
disparada por formulário no mesmo request). Verificado rodando `npm run build` e conferindo a
coluna `ƒ`/`○` da tabela de rotas — nunca assumir, sempre olhar a saída.

Testes de integração que passam por `signUp`/`billing/tick` (e-mails com link) agora dependem de
`PlatformSettings.publicBaseUrl` estar setado, porque não há requisição HTTP real nesses testes
(`headers()` lança fora de escopo, cai pro fallback). Resolvido com
`tests/integration/setup.ts` (`setupFiles` do `vitest.integration.config.ts`): seeda
`publicBaseUrl = "http://localhost:3000"` uma vez, só se ainda não houver valor — nunca
sobrescreve o que um teste específico (ex.: `platform-n8n-sync`) tenha configurado.

Ver também [[integration_tests_setup]] e [[migrate_diff_sem_tty]] (Cronos).
