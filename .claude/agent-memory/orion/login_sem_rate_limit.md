---
name: login_sem_rate_limit
description: Achado real da auditoria 2026-09-28 — login por credenciais não tem rate limit; verificar se Vega já corrigiu antes de reauditar do zero
metadata:
  type: project
---

Na auditoria de 2026-09-28 (`docs/seguranca/revisao-2026-09-28.md`), encontrei que
`src/lib/auth.ts` (provider `Credentials` do Auth.js v5) → `src/modules/auth/service.ts#verifyCredentials`
NÃO tem rate limit — `checkRateLimit` (`src/lib/rate-limit.ts`) só é chamado em `signUpAction`,
`requestPasswordResetAction` e `installPlatformAdminAction`, nunca no login. Login roda pela rota
padrão `POST /api/auth/callback/credentials`, fora de qualquer Server Action, então quem
implementar a correção precisa colocar o `checkRateLimit` DENTRO de `authorize()` mesmo (chave
`login:<ip>` e idealmente também `login:<email>`, porque IP sozinho é fácil de contornar no
Brasil/CGNAT).

Classifiquei como **Alta** (não Crítica) porque `verifyCredentials` já evita enumeration de
e-mail e usa bcrypt — o rate limit ausente é sobre volume de tentativas, não sobre vazar
informação. Recomendei corrigir antes de abrir cadastro público (não bloqueia o primeiro
deploy/trial fechado).

**Antes de reabrir este achado numa próxima revisão:** checar primeiro se
`src/lib/auth.ts`/`src/modules/auth/service.ts` já ganhou `checkRateLimit` — não repetir a
investigação do zero, só confirmar que a chamada existe e cobre o `authorize()`.

Ver também [[tenant_isolation_pattern]] e [[headers_seguranca_ausentes]].
