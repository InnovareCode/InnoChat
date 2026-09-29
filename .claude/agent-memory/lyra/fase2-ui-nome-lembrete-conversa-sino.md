---
name: fase2-ui-nome-lembrete-conversa-sino
description: Fase 2 da UI — sino generalizado por adapter (tenant+admin), aba Conversa com role=log, Minha conta, Switch, e as armadilhas medidas (build compartilhado, hidratação no E2E, sticky, lint de ícone).
metadata:
  type: project
---

- **Sino único para tenant e admin:** `useNotificationFeed(adapter)` em `use-notification-center.ts`; `useNotificationCenter(slug)` e `usePlatformNotificationCenter()` são só adapters. Provider do admin (`PlatformNotificationCenterProvider`) não tem live-refresh. Utils (`mergeNotifications`, `groupNotifications`, `pickToasts`) são genéricos sobre `BellNotification = AppNotification | AdminNotification`. Ícone por `ICON_BY_KIND[kind] ?? FALLBACK_ICON` (lookup estático).
- **Lint `react-hooks/static-components`:** função que devolve componente (`iconFor(x)`) e depois `<Icon/>` quebra o lint; usar lookup em objeto.
- **Aba Conversa** (`components/contacts/contact-conversation.tsx`): `role="log"` focável, balão `role="article"` com `aria-label` "Cliente, 14:32"/"Bot, 14:32", fundo reaproveita `ChatDoodle` + `WA_TOKENS` exportados de `whatsapp/phone-mockup.tsx`. Abre rolada ao fim (useLayoutEffect + ref), "carregar anteriores" preserva scroll pela diferença de scrollHeight. Separador de data NÃO pode ser `sticky` (chip pequeno tapava o texto do balão — coordenador reprovou o print). Tempo do balão inline: `flex flex-wrap` + `ml-auto`, senão hora cai sozinha em linha.
- **`Switch`** novo em `ui/switch.tsx` (44px, role=switch). `ui/switch` é o padrão; o painel do Mercado Pago ainda tem switch próprio (não migrado).
- **Minha conta** compartilhada (`components/account/`), rota fora do menu → chave `minha-conta`/`admin/minha-conta` em `ICON_BY_KEY` (CircleUser) + item extra em `section-label.tsx`. Depois de salvar: `router.refresh()` atualiza sidebar/saudação. Link no `UserBlock` dentro da gaveta mobile precisa fechar a gaveta (onClick no rodapé do `MobileNav`).
- **Armadilha de processo:** vários agentes rodam `next build` na MESMA pasta `.next`; meu `next start` da 3500 ficou com "client reference manifest does not exist" (500) porque servi durante o rebuild alheio. Sempre `build → matar/reiniciar o meu servidor → rodar E2E`, e se aparecer esse invariant, reiniciar.
- **E2E:** preencher form público logo após `goto` perde o valor se a hidratação vier depois → `waitForLoadState("networkidle")`. Toast do projeto renderiza texto duplicado (visível + sr-only) → `getByText(..., {exact:true})`. Limite de plano agora é card na UI; o teste de `PLAN_LIMIT_REACHED` virou asserção do card (a recusa do servidor fica no teste de integração).
- Cadastro público já tinha `ownerName` obrigatório; só ajustei 2–80. Convite manda `{token, name, password}`; instalação manda `name` opcional.
