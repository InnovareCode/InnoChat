---
name: central-de-notificacoes-e-refresh-ao-vivo
description: Arquitetura do sino/toasts/polling e do "atualizar sozinho" (sem F5) em src/components/notifications, mais as armadilhas medidas (portal, backdrop-filter, Prisma stale, substring no E2E, rate limit).
metadata:
  type: project
---

Provider único `NotificationCenterProvider` (dentro do `PanelShell`) dono do polling (30 s; 15 s em
`/agenda` e `/agendamentos`; pausa com aba oculta; backoff 2^n até 5 min; poll imediato no
`visibilitychange`). Sino, toasts, card "Próximos atendimentos hoje" e as telas leem dele.
Lógica pura testável: `notification-utils.ts` (tempo relativo, agrupamento, backoff, `pickToasts`,
contador) e `live-refresh.ts` (quais kinds refrescam, debounce/adiamento via `createRefreshCoordinator`).

Decisões que não são óbvias:
- Agenda/Agendamentos/Clientes buscam dados NO CLIENT (`useEffect`) — `router.refresh()` sozinho não
  atualiza nada ali. O provider expõe `version` + `useOnAppointmentsChanged(cb)`; cada tela faz
  `load(true)` (silencioso, sem skeleton). Realce por `highlightedIds` (5 s) via classe `.appt-highlight`.
- Adiamento do refresh: diálogo Radix aberto (`[role=dialog][data-state=open]`) ou
  `document.body.dataset.apptDrag === "1"` (a Agenda liga durante o arraste). Pílula "Há atualizações — Atualizar".
- Toast: não mostrar se `byMe`; painel aberto → sem toast; máx. 3; próprio componente (a topbar tem
  `backdrop-filter`, que prende filhos `fixed` — por isso painel e toasts vão por `createPortal` no body).
- Popover próprio (o projeto NÃO tem `@radix-ui/react-popover`): Esc, clique fora, Tab circula, foco
  devolvido ao sino; no celular o mesmo DOM vira sheet por CSS.
- `document.title` recebe "(n) " e um MutationObserver reaplica quando o Next troca o título.
- Status/origem do agendamento têm fonte única em `components/agenda/appointment-status.tsx`
  ("Faltou", nunca "Não veio").

Armadilhas:
- **Prisma client velho no `next dev` já rodando**: depois de migration + `prisma generate`, o dev server
  continua com o client antigo (erro `Unknown argument tenantId`). Restart obrigatório; para provar sem
  mexer no processo alheio, `npm run build` + `next start -p 3100` (meu processo) — `output: standalone`
  só avisa. `next start` e o E2E leem o mesmo `.env`.
- E2E: `getByRole("button", {name: "Todas"})` também casa "Marcar todas como lidas" (substring,
  case-insensitive) → usar `exact: true`.
- Rate limit de login é em memória do servidor (8/15 min por e-mail): cada `global-setup` + scripts
  soma. Reaproveitar `storageState` e reiniciar só o servidor que é seu.
- `global-setup.ts` tem `localhost:3000` fixo; para outra porta é preciso cópia temporária.
- `.appt-highlight` e `--shadow` são CSS sem camada: sobrescrevem `shadow-card` do Tailwind durante o realce (intencional); não
  usar `background` nela (venceria as cores de status do bloco).
- Flake não explicado: `responsive.spec` (360 px, rota da agenda) reprovou 1 de ~6 execuções com
  scrollWidth 365 vs 360; não reproduzi medindo 25 cargas à parte. Se voltar, medir o elemento na hora da falha.
