---
name: authjs-v5-signin-redirect-false
description: "Auth.js v5-beta.32: signIn('credentials', { redirect:false }) LANÇA CredentialsSignin em credencial inválida, não devolve URL com ?error= — verificado com Playwright, não só lendo o código-fonte"
metadata:
  type: feedback
---

Em `src/app/(public)/login/actions.ts`, a primeira leitura de
`node_modules/next-auth/lib/actions.js` sugeria que `signIn(provider, {
redirect: false })` sempre devolve a URL de redirecionamento como string
(inclusive em erro, com `?error=CredentialsSignin` embutido), então o
primeiro código só checava `result.includes("error=")` sem `try/catch`.

**Why:** isso estava errado na prática — testado com Playwright real
(usuário/senha errados), o `signIn` **lança** `CredentialsSignin`
(subclasse de `AuthError`, `instanceof AuthError` funciona) antes de
devolver qualquer coisa, e sem `try/catch` isso vira erro 500 (tela
"This page couldn't load" do Next), não a mensagem genérica de senha
inválida. Lição maior: em beta/RC de uma lib (next-auth v5 ainda é beta),
não confiar só na leitura do código-fonte — rodar o caminho de erro de
verdade no navegador antes de dar como certo (mesma régua de
`medir-antes-de-afirmar`, mas para comportamento de biblioteca, não layout).

**How to apply:** todo uso de `signIn(..., { redirect: false })` neste
projeto precisa de `try { ... } catch (err) { if (err instanceof AuthError)
{ /* mensagem genérica */ } throw err; }` — nunca assumir que o retorno
by-value cobre o caminho de erro.
