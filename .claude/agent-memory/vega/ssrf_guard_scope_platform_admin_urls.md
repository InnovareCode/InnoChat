---
name: ssrf-guard-scope-platform-admin-urls
description: Defesa SSRF leve para URLs configuradas pelo admin (Evolution/n8n) — o que bloquear e o que deliberadamente NÃO bloquear, e por quê
metadata:
  type: project
---

`src/lib/net/safe-fetch.ts` (revisão de segurança 2026-09-28, achado MÉDIA) — usado em
`platform/connection-tests.ts` ("Testar conexão" de Evolution/n8n) e `platform/n8n-client.ts`
(sync do n8n). Regra de decisão (repassada pelo Atlas, registrar para não relaxar demais nem
apertar demais numa rodada futura):

- **Bloqueia**: esquema diferente de `http`/`https`; o endereço de metadados de nuvem
  `169.254.169.254`; redirecionamento para um HOST diferente do original.
- **NÃO bloqueia IP privado/loopback em geral** — decisão deliberada, não esquecimento: a
  Evolution e o n8n do dono normalmente estão na MESMA rede interna do Easypanel que o InnoChat,
  então bloquear RFC 1918/loopback quebraria o uso legítimo mais comum. Só quem chega até aqui é
  `requirePlatformAdmin()` (já o papel de maior confiança do sistema) — o risco real é só (a)
  admin comprometido sondando a rede interna, (b) erro humano de URL — daí a defesa ser "leve",
  não paranoica.

Se um dia isto precisar mudar (ex.: expor "testar conexão" para um papel de menor confiança),
reavaliar bloquear IP privado por padrão — a decisão atual está amarrada à premissa "só admin da
plataforma chega aqui".
