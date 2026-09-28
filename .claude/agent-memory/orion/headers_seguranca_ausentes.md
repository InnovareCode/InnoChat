---
name: headers_seguranca_ausentes
description: Achado real da auditoria 2026-09-28 — nenhum header de segurança (CSP/HSTS/X-Frame-Options) configurado; sem middleware.ts nem headers() no next.config.ts
metadata:
  type: project
---

Na auditoria de 2026-09-28 (`docs/seguranca/revisao-2026-09-28.md`), confirmei que
`next.config.ts` só tem `output: "standalone"` — sem bloco `headers()` — e não existe
`src/middleware.ts` no projeto. Ou seja: zero `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`.

Classifiquei como **Alta**: painel expõe clickjacking (login e telas de tenant embutíveis em
iframe malicioso) e fica sem a rede de segurança de CSP contra XSS. Recomendei ao menos
`X-Frame-Options: DENY`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e uma CSP
inicial `default-src 'self'` (o painel não carrega nenhum script/CDN de terceiro hoje, então uma
CSP restritiva de início é viável sem quebrar nada visto nesta auditoria).

**Antes de reabrir este achado numa próxima revisão:** checar se `next.config.ts` ganhou
`headers()` (ou se apareceu um `src/middleware.ts`) antes de repetir a busca.

Ver também [[login_sem_rate_limit]] e [[tenant_isolation_pattern]].
