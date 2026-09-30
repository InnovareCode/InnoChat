---
name: google-login-design
description: Login com Google no InnoChat (2026-09-30) — decisões, armadilhas do Auth.js v5 beta.32 e como testar sem Google real
metadata:
  type: project
---

Onde mora: `src/modules/google-auth/` (config, signin, signup, tokens, session, actions do convite),
`src/lib/auth.ts` (NextAuth lazy), admin actions em `src/modules/platform/actions.ts`, contrato em
`docs/contratos.md` "Login com Google". Credenciais no banco (secret cifrado), nada em env var.

**Armadilhas (causa raiz -> como evitar):**
- Provedor Google do Auth.js vem só com `checks: ["pkce"]` (sem `state`, sem `nonce`). Conferido olhando o
  Location do `/api/auth/signin/google`. Sempre setar `checks: ["pkce","state","nonce"]` explícito.
- `user.id` do provedor OAuth é o `sub` do Google, não o nosso id: o `jwt` callback resolve `userId` por
  `User.googleSub` (senão a sessão nasce com id errado).
- Importar `@/lib/auth` (Auth.js) num arquivo de actions quebra os testes de integração que o importam
  (`next-auth/lib/env.js` não resolve `next/server` no vitest). Usar `await import("@/lib/auth")` dentro
  da função (foi o caso de `completeGoogleSignUpAction`).
- Vínculo por e-mail em conta NÃO verificada descarta a senha (pre-hijacking). Convite de conta já
  verificada mantém a senha.
- Token de cadastro: uso único amarrado ao `sub` (sem tabela de jti); a trava é `googleSub`/`email` únicos.
  Token nunca abre sessão sozinho; a sessão pós-cadastro usa prova `google-login` de 60 s gerada e consumida
  na mesma action (provedor Credentials interno `google-signup`).
- Botão "Entrar com Google" na tela colide com `getByRole("button",{name:"Entrar"})` nos E2E: usar
  `exact: true` (corrigido em fixtures/auth.ts e specs).

**Como testar sem Google:** unit (`signin.test.ts`, `tokens.test.ts`), integração
(`tests/integration/google-auth.integration.test.ts`), e smoke Playwright assinando o token com a mesma
fórmula (sha256 de `innochat:google-auth:<purpose>:<AUTH_SECRET>` como chave HMAC). O fluxo real com o Google
só o dono valida (OAuth Client no Cloud Console, runbook).

**Ambiente:** `node_modules/.bin` some às vezes (outro agente mexendo) — rodar ferramentas por
`node node_modules/<pkg>/...`. Build paralelo sem pisar em `.next`: `NEXT_DIST_DIR=.next-x` (next.config.ts) e
`AUTH_URL=http://localhost:<porta>` ao servir em porta != 3000 (senão signOut redireciona para 3000).
Heredoc bash com certos textos em pt-BR quebra o parser da ferramenta: usar Write para arquivos grandes.
