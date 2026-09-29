---
name: bugs-found-log-round4
description: Rodada 2026-09-29 (notificações + sistema de espera) — causas raiz reais das falhas E2E contra build de produção (prod build limpa em porta 3200)
metadata:
  type: project
---

- **Rodar E2E contra `next start -p 3200`**: config temporária que importa `playwright.config.ts`, remove `webServer`
  e muda `baseURL`; `global-setup.ts` aceita `E2E_BASE_URL` (retrocompatível). Subir o servidor com
  `AUTH_URL=http://localhost:3200 AUTH_TRUST_HOST=true`. Reiniciar o servidor antes de cada rodada
  (rate limit de cadastro/login em memória). `next build` sobrescreve `.next`: nunca com o 3200 no ar.
- **Tour do Inno (`OnboardingTourProvider autoStart`)** abre 700ms depois da página para usuário com
  `onboardingTourCompletedAt = null` e o overlay (`z-[70]`) intercepta cliques. Usuário de fixture E2E
  novo precisa nascer com `onboardingTourCompletedAt: new Date()`.
- **`loading.tsx` faz `notFound()` devolver HTTP 200** (streaming; docs do Next). Testes de isolamento
  devem afirmar o conteúdo 404, não o status.
- **Sync do n8n** exige nó `n8n-nodes-base.webhook` (com `webhookId` se o path tem `:token`) no workflow fake
  (`deriveWebhookBaseUrl`, commit 61f3139) — senão `N8N_WEBHOOK_NODE_NOT_FOUND` e nenhum "Sincronizado:".
- **Drag na Agenda flaky (~40%) = autoscroll do dnd-kit**: a linha de 10:00 ficava na borda de baixo da grade
  em viewport 720px (a linha de estatísticas nova empurrou a grade). Viewport 1280x1000 resolve (32/32).
- **Agenda mobile 360px**: cabeçalho do card por profissional sem `min-w-0`/`break-words`; nome sem espaço
  longo (o de fixture `E2E_TEST_DATA_<ts> Carla`) estoura 2px. Bug de produto pequeno, ainda aberto.
- O "Unknown argument tenantId/disconnectedAt" NÃO se reproduziu na build limpa: era o `next dev` velho na 3000.
