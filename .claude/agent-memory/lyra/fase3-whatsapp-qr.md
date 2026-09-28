---
name: fase3-whatsapp-qr
description: Tela WhatsApp (QR code, polling, sidebar dot) — componente reutilizável de conexão e lição de closure com timers em React
metadata:
  type: project
---

Fase 3 (2026-09-28): tela `/[tenantSlug]/whatsapp` implementada consumindo `src/modules/whatsapp/actions.ts`.
Peça central é `src/components/whatsapp/connect-whatsapp-dialog.tsx` — dialog em 3 passos (rótulo →
QR → sucesso), reutilizado também no onboarding (passo 3), por pedido explícito do dono
("mesmo componente de conexão"). Qualquer mudança no fluxo de conexão (novo erro, novo campo do
`QrCodeView`) precisa ser feita ali uma vez só — não forkar para o onboarding.

**Why:** o dono pediu explicitamente reaproveitar o componente entre as duas telas; forkar geraria
duas fontes de verdade para o mesmo fluxo crítico (é a tela mais importante do produto).

**How to apply:** ao tocar de novo nessa área, procurar primeiro por
`connect-whatsapp-dialog.tsx` antes de criar qualquer coisa nova para "conectar WhatsApp".

## Lição de bug (causa raiz, não sintoma)

`setInterval`/`setTimeout` cujo callback foi criado em um certo render **fecham sobre o `state`
daquele render**, não sobre o mais recente — `setState` é assíncrono, então ler `state` dentro de
um timer de longa duração pode pegar um valor void/desatualizado mesmo que o componente já tenha
re-renderizado várias vezes.

**Why:** ao mesclar `phoneE164`/`status` no objeto "conectado" dentro do `tick()` do polling do QR,
usar `instance` (state) direto devolveria `null` na primeira chamada (o `setInstance` da criação
ainda não tinha efetivado quando o primeiro `tick()` já era disparado sincronamente).

**How to apply:** quando um timer de vida longa precisa do valor MAIS RECENTE de algo que também é
state, espelhar esse valor num `useRef` atualizado junto com o `setState` (padrão `updateInstance`
em `connect-whatsapp-dialog.tsx`: atualiza `instanceRef.current` e chama `setInstance` no mesmo
lugar) e ler do ref dentro do timer, nunca do state capturado no closure.

## Convenção confirmada

Tipos de retorno de Server Actions (`WhatsappInstanceView`, `QrCodeView`, `ConnectionStatusView`)
precisam ser reexportados no próprio `actions.ts` com `export type { ... }` — mesmo padrão já usado
em `PlanListItem` (`src/modules/billing/actions.ts`). Client Component nunca importa tipo direto de
`service.ts` (camada de domínio), só de `actions.ts`.

Relacionado: [[bug-icone-server-para-client]] (mesma lógica de fronteira servidor/cliente, agora
aplicada ao booleano `dot`/`whatsappNeedsAttention` da sidebar em vez de ícone).
