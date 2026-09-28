---
name: login-rate-limit-e2e
description: Login novo tem rate limit de 8 tentativas/15min POR E-MAIL (segurança 2026-09-28) — um spec que faz login repetido com o mesmo usuário em quase todo teste estoura o limite no meio da suíte
metadata:
  type: project
---

`src/modules/auth/service.ts` (`checkRateLimit`) — `LOGIN_EMAIL_LIMIT = 8` por
`LOGIN_EMAIL_WINDOW_MS = 15 * 60 * 1000`, além de `LOGIN_IP_LIMIT = 20` por 5min. Excedendo
qualquer um, `verifyCredentials` devolve o MESMO "credencial inválida" (sem revelar rate limit).

Um spec de vários cenários que faz `login()`/`loginAndWaitForPanel()` de NOVO a cada `test()`
para o MESMO usuário (ex.: `whatsapp.spec.ts`, 9 testes como o mesmo OWNER) esbarra nesse limite
por volta do 9º login dentro da janela de 15min — o teste falha com "user_not_found"-like (na
prática, mensagem genérica de credencial inválida) e `page.waitForURL` nunca resolve.

**Como aplicar:** specs com muitos testes usando o MESMO usuário devem logar de verdade só UMA
vez e reaproveitar o cookie de sessão nos demais (`context.cookies()` depois do primeiro login,
`context.addCookies(...)` nos seguintes, antes de `page.goto`) — as guards (`requireTenantMember`,
`requireVerifiedEmail` etc.) sempre releem tudo do banco a cada chamada, então mudar
`emailVerifiedAt`/status da assinatura/etc. entre testes continua valendo mesmo com um cookie
"velho" (a sessão só carrega o id do usuário, nada mais). Ver o helper `loginOwner()` em
`tests/e2e/whatsapp.spec.ts`.

Specs que testam MENOS de ~6 vezes com o mesmo e-mail na mesma rodada não precisam se preocupar
com isso — o limite é generoso o bastante para o uso normal (login errado por engano, várias
abas).

**Achado mais sério (2026-09-28, 2ª rodada): isso quebra a suíte INTEIRA, não só specs
isolados.** `dev@innochat.local` (`SEED_OWNER_EMAIL`) é reusado como login em praticamente TODO
spec pré-existente (`auth`, `admin-secrets`, `admin-configuracoes` x6, `assinatura`,
`bloqueios-empresa`, `catalog-and-agenda`, `csp`, `dates-timezone`, `tenant-isolation`, `themes`,
mais os novos desta rodada) — rodando `npx playwright test` sem filtro (a suíte inteira, ~60
testes), o total de logins reais como esse e-mail estoura os 8/15min bem antes do fim, e a
FALHA se espalha por dezenas de testes SEM RELAÇÃO NENHUMA com o que cada um testa de verdade
(confirmado: os logs mostram `reason: "email"`, sempre para esse e-mail, nunca `"ip"`). Rodando
CADA arquivo isoladamente (`npx playwright test <arquivo>`), tudo passa — é a COMBINAÇÃO que
quebra. Isso é uma regressão real de infraestrutura de teste introduzida pelo rate limit de
login (commit "rate limit no login, headers/CSP..."), não um bug nas telas testadas. Reportado
para o Atlas/Vega decidirem entre (a) exemptar/relaxar o limite para o e-mail de seed ou para
requisições locais/`NODE_ENV=test`, ou (b) refatorar TODOS os specs pré-existentes para o padrão
de reuso de cookie (`loginOwner()` de `whatsapp.spec.ts` é o modelo) — b) é o certo a longo
prazo, mas é um refactor grande demais para uma sessão só.
