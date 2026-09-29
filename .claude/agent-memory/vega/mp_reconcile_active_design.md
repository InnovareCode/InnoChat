---
name: mp-reconcile-active-design
description: Conciliação ativa de Pix (reconcile.ts), ambiente da fatura, rate limit no banco e diagnóstico do webhook — decisões e armadilhas
metadata:
  type: project
---

Bug de 2026-09-29: dono pagou Pix sandbox e a fatura ficou OPEN (baixa dependia só do webhook, que
pode ser rejeitado por segredo de ambiente trocado). Solução: `src/modules/billing/reconcile.ts`.

- Fatura guarda `mpEnvironment` (gateway expõe `.environment`; `pixEnvironmentFor(gateway)` cai no
  ativo para fakes). Legado nulo: tenta ativo, depois o outro, e grava o que funcionou.
- Rate limit de consulta = UPDATE condicional atômico em `Invoice.mpLastCheckedAt` (vale entre
  instâncias, ao contrário do `checkRateLimit` em memória). Tick/admin passam `minIntervalMs: 0`.
- Sempre conferir `payment.externalReference === invoice.id` antes de baixar.
- `ProviderEvent` é global por (provider, providerEventId): o mock do MP gerava `mock_pay_1` em toda
  instância e colidia entre testes — ids do mock agora têm sufixo aleatório.
- Diagnóstico do webhook: `wrong_environment_secret` (assinatura bate com a chave do OUTRO ambiente)
  é o motivo mais útil para "modo teste x produção" no painel do MP. Escrita de rejeição tem throttle 2s.
- `prisma generate` dá EPERM se há `next dev` segurando a DLL; os tipos/JS atualizam mesmo assim e a
  integração roda (só a DLL do engine, inalterada, não é regravada).
- Heredoc muito grande no Bash tool falhou com "unexpected EOF"; use Write para arquivos grandes.
