---
name: bugs-found-log-2026-09-28-round2
description: Registro de bugs encontrados na 2ª rodada de 2026-09-28 (telas novas de Configurações/Instalação/Assinatura/Bloqueios/Suspensão/Cadastro + CSP + WhatsApp) — para o ciclo de mitigação
metadata:
  type: project
---

Rodada: E2E das 5 telas novas do Atlas (admin/configurações, /instalacao, assinatura, bloqueios,
suspensão) + cadastro público ponta a ponta + CSP nova (`next.config.ts`) + tela WhatsApp com
Evolution fake + causa raiz de um teste de integração falhando.

1. **Bug de produto — link de "esqueci a senha" quebrado**: `requestPasswordReset`
   (`src/modules/signup/service.ts`) monta o link do e-mail como
   `/recuperar-senha/confirmar?token=...`, mas a página que de fato consome o token é
   `/redefinir-senha?token=...`. Não existe rota `/recuperar-senha/confirmar` — o link real do
   e-mail sempre dá 404. `resetPasswordAction` em si funciona (provado usando a rota certa com o
   mesmo token). Reprodução mínima em `tests/e2e/cadastro.spec.ts` (teste "com SMTP fake").
   PARA O PRÓXIMO: Vega corrige o `resetUrl` para `/redefinir-senha?token=...`.

2. **Bug de produto (UX, menor) — diálogo de sucesso do WhatsApp some na PRIMEIRA conexão**: ao
   conectar o primeiro número de WhatsApp da empresa, o passo "Número conectado"/"Concluir" do
   `ConnectWhatsappDialog` nunca aparece — o diálogo fecha sozinho no instante em que a conexão é
   detectada. Causa: o gatilho que abriu o diálogo mora dentro do `EmptyState`
   (`instances.length === 0`, `whatsapp-client.tsx`); o `onConnected` atualiza a lista, a empresa
   deixa de estar vazia, o `EmptyState` (e o diálogo aberto dentro dele) desmonta, e um NOVO
   `ConnectWhatsappDialog` nasce (fechado) no cabeçalho. A partir do SEGUNDO número em diante não
   acontece (o diálogo já mora no cabeçalho, que não desmonta). O card atualiza certo mesmo assim
   — só a confirmação visual se perde. Reprodução em `tests/e2e/whatsapp.spec.ts` (teste "fluxo
   feliz"). PARA O PRÓXIMO: Lyra decide (dar uma `key` estável ao trigger, ou içar o diálogo para
   fora do `EmptyState`/cabeçalho condicional).

3. **Bug de TESTE (não de produto) — corrigido nesta rodada**:
   `tests/integration/bot-api-gaps.integration.test.ts`, "cancelar fora do prazo mínimo funciona
   normalmente" usava `startsAt = Date.now() + 60*60_000` (exatos 60min) enquanto
   `Tenant.minLeadTimeMin` tem `@default(60)` no schema — entre o `Date.now()` do teste e o `now`
   que o SERVIDOR recaptura minutos depois (após os round-trips de `createAppointmentBot`), o
   `start` cai levemente ABAIXO do limiar de 60min, disparando `RULE_VIOLATION`/`LEAD_TIME` por
   pura corrida de relógio — nunca foi um bug de `checkBookingWindow`. Corrigido usando +90min
   (folga real). Suspeita original da Vega era "grade de `slotGranularityMin`" — não é isso:
   `checkBookingWindow` (`src/core/agenda/availability.ts`) não valida alinhamento de grade
   nenhum, só `OUTSIDE_HOURS`/`LEAD_TIME`/`HORIZON`.

4. **CSP nova (`next.config.ts`) — sem violações** em login, Agenda (dia/semana), Admin →
   Configurações, Assinatura (QR do Pix via `data:` URL) e WhatsApp (QR da Evolution via
   `data:` URL). Verificado com `document.addEventListener("securitypolicyviolation", ...)` +
   console — `tests/e2e/csp.spec.ts` e o mesmo helper reaproveitado em `whatsapp.spec.ts`.

5. **Gap de dados de seed, não bug**: os 3 planos (`essencial`/`profissional`/`clinica`) nascem
   `active: false` — a tela "Planos disponíveis" (Assinatura) fica vazia com dados de seed puros.
   `assinatura.spec.ts` ativa Essencial/Profissional temporariamente e restaura no `afterAll`.

Nenhum outro bug de lógica/segurança encontrado nesta rodada. Ver `[[bugs_found_log]]` (rodada
1, mesma data) para o achado de Prisma Client desatualizado e o gap de bloqueio da empresa
inteira (esse último já virou tela própria nesta rodada — `configuracoes/bloqueios`).
