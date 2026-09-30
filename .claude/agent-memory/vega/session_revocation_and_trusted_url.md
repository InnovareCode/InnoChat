---
name: session-revocation-and-trusted-url
description: Correções do Órion no login Google (2026-09-30) — sessionVersion no JWT, base pública confiável fixando AUTH_URL, cookie do token de cadastro, IP por último XFF; armadilhas de teste
metadata:
  type: project
---

**Padrões decididos (causa raiz -> como evitar):**
- JWT sem revogação: `User.sessionVersion` + `sv` no token; `jwt` callback devolve `null` se diferir (cache 5 s em
  `src/modules/auth/session-version.ts`). Incremente NO MESMO update que troca a credencial (vínculo em conta não
  verificada, reset de senha, `signOutEverywhere`). Novo caminho que troque credencial => incrementar também.
- Host header: `getPublicBaseUrl()` = base gravada primeiro, cabeçalho só sem base (instalação).
  Auth.js: `pinAuthUrlToTrustedBase()` em `buildConfig` seta `process.env.AUTH_URL` (next-auth lê a cada
  request: `reqWithEnvURL` + `createActionURL`). `AUTH_URL` do operador (dev tem no .env) vence e nunca é sobrescrito.
  `ensurePublicBaseUrlFromCurrentRequest` só preenche se vazia; troca = `setPublicBaseUrlAction` explícita.
- Token de cadastro Google: cookie httpOnly com sha256 do token além do `?t=`; check nas ACTIONS (não no service,
  senão quebra os testes de integração do service).
- IP: último valor do XFF (`TRUSTED_PROXY_HOPS = 1`), `isIP` valida.

**Armadilhas de ambiente/teste:**
- node_modules pode aparecer meio apagado (sem `.bin`, sem `@auth/core`): `npx --yes npm@10.9.9 ci` resolve (1 min) e não muda o lockfile.
- Testar o handler real do Auth.js no vitest de integração: `server.deps.inline: ["next-auth"]` no config +
  `vi.stubEnv("AUTH_URL","")` antes do import dinâmico de `@/lib/auth`; sessão de teste = `encode` de `next-auth/jwt`
  com salt = nome do cookie (`__Secure-authjs.session-token` se a base é https). Fiz mutação (pin desligado) e o teste falhou: é sensível.
- Heredoc bash com apóstrofo (`'esqueci a senha'`) quebra o parser da ferramenta: usar Write. `python3 -` trava no Windows: usar `node -`.
- `next build` reescreve `tsconfig.json` (inclui `.next-<x>/types`): `git checkout tsconfig.json` no fim.
- E2E com config própria: config `.mjs` precisa estar DENTRO do projeto (resolve `@playwright/test`); `E2E_BASE_URL` para o globalSetup.
