---
name: google_login_review_2026-09-30
description: Revisão do login com Google (commit 54469e5) — sem CRÍTICO; padrões: pre-hijacking residual por JWT sem revogação, host de x-forwarded-* em links de e-mail, convite consumido não-atomicamente
metadata:
  type: project
---

Revisão 2026-09-30 do commit 54469e5: 0 CRÍTICO, 3 IMPORTANTE, várias SUGESTÃO, APROVADO com ressalvas.
Desenho sólido: HMAC por finalidade + timingSafeEqual, admin recusado em 3 pontos, checks pkce/state/nonce, secret cifrado e nunca devolvido.

Padrões a rechecar em mudanças futuras de auth:
- Sessão JWT sem revogação (sem tokenVersion): descartar a senha no vínculo Google NÃO derruba sessão que o atacante já abriu (login por senha não exige e-mail verificado).
- `getPublicBaseUrl` prioriza `x-forwarded-host`/`host` da requisição (src/lib/public-url.ts) e gera link de reset/convite: host header poisoning depende de o Traefik sobrescrever os headers (não verificado).
- `clientIp` usa o 1º valor de x-forwarded-for (spoofável) e rate limit é em memória.
- Convite Google: `authToken.updateMany` (consome) antes do `user.update` sem transação; unique violation em googleSub queima o convite.
- Token `google-signup` viaja em `?t=` e o 1º portador que completa o cadastro ganha sessão.
