---
name: static-optimization-trava-dado-de-banco
description: Página pública (sem auth/cookies) que lê o banco num Server Component vira estática no build — dado congela até o próximo deploy, a menos que force `revalidate`.
metadata:
  type: feedback
---

Uma rota do App Router sem `cookies()`/`headers()`/`auth()` e sem `export const dynamic` é
elegível para **static optimization**: o Next roda o Server Component NO BUILD (não a cada
request) e serve o HTML gerado como estático (`○` na tabela de rotas do `next build`).

**Onde mordeu:** `/termos` e `/privacidade` (`src/app/(public)/termos/page.tsx`,
`.../privacidade/page.tsx`) passaram a chamar `getPublicLegalInfo()` (leitura direta do banco,
`src/modules/platform/legal-service.ts`) para preencher os marcadores `[CNPJ]`/`[ENDEREÇO]`/etc.
via `fillLegalPlaceholders`. Sem nada mais, o `next build` as marcou `○ (Static)` — o dado do
banco ficaria CONGELADO no valor que existia no momento do build. Um admin editando "Dados
jurídicos" depois do deploy não veria efeito nenhum nas páginas públicas até o próximo build,
contrariando o objetivo inteiro da feature (admin edita, público reflete).

**Correção:** `export const revalidate = 60;` no `page.tsx` — ISR com a mesma janela do cache de
integrações (`health-service.ts`, `INTEGRATIONS_CACHE_TTL_MS = 60_000`), mantendo o benefício de
performance (não bate no banco a cada request) sem congelar o dado indefinidamente.

**Como não cair de novo:** depois de tocar QUALQUER página pública (`(public)/`) que passou a ler
banco/config em vez de só texto estático, rodar `npm run build` e olhar a coluna de símbolo na
tabela de rotas — `○` para uma página cujo conteúdo pode mudar em runtime é o sinal de alerta.
`ƒ` (dynamic) ou `revalidate` explícito são as duas saídas válidas; qual delas depende de quanto
a leitura pesa e quão fresco o dado precisa estar.
