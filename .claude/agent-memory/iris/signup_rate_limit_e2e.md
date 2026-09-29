---
name: signup-rate-limit-e2e
description: Rate limit de cadastro público (5/hora por IP, em memória) esgota ao rodar cadastro.spec.ts várias vezes contra o mesmo `next dev` — mesma família de problema do login_rate_limit_e2e
metadata:
  type: project
---

`src/modules/signup/actions.ts` — `SIGNUP_LIMIT = 5` cadastros/hora por IP (`checkRateLimit`,
em memória do processo do servidor), checado ANTES de qualquer validação (então até "slug
duplicado"/"e-mail duplicado" — que dão erro de negócio, não de rate limit — consomem 1 dos 5).
`cadastro.spec.ts` faz até 5 chamadas reais a `signUpAction` por execução — no teto exato: slug
duplicado, e-mail duplicado, sem SMTP, com SMTP fake, CPF válido ("CPF inválido" e "slug
reservado" são client-side puro e não contam).

**Por que importa para "2 rodadas seguidas verdes":** como é em memória do processo, sobrevive
entre rodadas se o `next dev` não for reiniciado entre elas. 2 rodadas × 5 chamadas = 10, acima do
teto de 5/hora — a 2ª rodada quebra em "e-mail duplicado"/"sem SMTP"/"com SMTP fake"/"CPF válido"
com uma
mensagem de erro genérica (a UI mostra "Muitas tentativas..." só se o teste checasse; aqui
apareceu como "Confirme seu e-mail"/"Esse endereço já está em uso" nunca aparecendo — a ação
nem chega a validar porque já falhou no rate limit antes).

**Como aplicar:** reiniciar o `next dev` antes de CADA rodada de `npm run test:e2e` que inclua
`cadastro.spec.ts` (não só antes da primeira) — mesma prática já registrada em
[[login_rate_limit_e2e]] para o rate limit de login. Rodar `cadastro.spec.ts` isolado várias vezes
em sequência manual (para depurar um seletor, por ex.) contra o MESMO servidor também esgota a
cota — se precisar depurar, reinicie o servidor entre as tentativas ou aumente a paciência para
esperar a janela de 1h.
