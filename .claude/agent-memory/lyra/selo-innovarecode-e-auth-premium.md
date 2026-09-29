---
name: selo-innovarecode-e-auth-premium
description: Selo fixo InnovareCode + assinatura em texto + redesign premium das telas de auth; armadilhas de AA, toast, getByLabel e next.config env
metadata:
  type: project
---

- Versão/data vêm de `next.config.ts` (`env` NEXT_PUBLIC_APP_VERSION/BUILD_DATE, lê package.json) -> `src/lib/app-info.ts`. vitest.config injeta as mesmas env, senão o teste "versão == package.json" cai no fallback.
- Selo (`components/brand/innovarecode-badge.tsx`): translucidez só na SUPERFÍCIE (`bg-surface/80`); `opacity-70` no conteúdo reprova AA. z-40 < tour (70/80). Toast viewport subiu para `bottom-[4.5rem]` para não cobrir o selo; `main` dos shells com `pb-20`.
- Assinatura em texto (`AppSignature`) só em telas públicas/auth; painéis têm só o selo (nunca os dois).
- Auth: `AuthShell` + `AuthPanel` + `AuthInput` (ícone, 48px, mostrar/ocultar). O aria-label do botão de senha NÃO pode conter "senha": E2E usa `getByLabel("Senha")` (substring) e daria strict-mode violation.
- `Field` ganhou `labelAction` (link à direita do label).
- Pendência de ambiente: `playwright.instalacao.config.ts` falha se já houver `next dev` na 3000 (lock do Turbopack); não matar processo alheio.
