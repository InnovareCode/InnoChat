---
name: login-google-ui
description: UI do login com Google (botao, /cadastro/google, card admin) - decisoes e armadilhas medidas
metadata:
  type: project
---

- Botao Google = `<form action={serverAction}>` (`components/public/google-button.tsx` + `app/(public)/google-actions.ts`, `signIn("google",{redirectTo:"/pos-login"})` de `@/lib/auth`). Sem try/catch: o redirect do signIn tem que propagar. `GoogleEntry` (server) consulta `getPublicAuthOptions` e some se false/erro.
- Cores do botao/logo G sao hex fixos de proposito (marca Google), 48px = altura dos AuthInput.
- `/cadastro/google` reaproveita `FormSection`/`TermsCheckbox` extraidos para `components/public/signup-shared.tsx`; planos vem de `listActivePlans()` no Server Component (nao ha action publica). Cadastro normal nao escolhe plano; so o do Google.
- Erros do Auth.js em `?error=` mapeados em `components/public/google-auth-errors.ts`.
- Armadilhas medidas: grid filho precisa `min-w-0` (linha de copiar vazava a 390); header de card com titulo+switch usa `min-w-[16rem]` no bloco do titulo para quebrar linha no mobile; `Button asChild` ignora `icon` -> icone vai dentro do Link; toast variant e "error" (nao "danger"); PageTransition duplica o DOM por instantes (testid com 2 matches).
- Ambiente: `node_modules/.bin` vazio e `npx` quebra as vezes; rodar `node node_modules/<pkg>/...`. Login do dev@ tem rate limit (8/15min) - scripts de print que logam muitas vezes estouram.
- Classificador negou UPDATE direto no banco dev; reverter config de teste pela UI do admin (Remover credencial salva desliga o login Google).
