---
name: onda-premium-paginas-lista
description: Checklist do padrão premium aplicado a uma tela de lista (Agendamentos/Clientes/Serviços/Profissionais/WhatsApp) — o que copiar quando a próxima onda de telas herdar o mesmo visual do protótipo aprovado.
metadata:
  type: project
---

Onda 1 (2026-09-28, commit pendente) estendeu o padrão premium do protótipo aprovado
(`71a53c4`/`3035b11`) às telas de Agendamentos, Clientes, Serviços, Profissionais (lista+detalhe)
e WhatsApp. Checklist reaproveitável para a próxima onda de telas que herdar o mesmo visual:

- `Card` de tabela ganha `rounded-hero` explícito (o padrão do componente é `rounded-card`, menor
  — só os cartões "hero" de destaque usam a classe maior, igual ao `inicio/page.tsx` e
  `agenda-client.tsx` já faziam).
- Toda tabela desktop (`hidden ... md:block`) precisa de um par `md:hidden` com lista de `Card`s
  — o padrão já existia em Clientes, mas Agendamentos/Serviços/Profissionais ainda não tinham
  (só tinham `overflow-x-auto` dentro do próprio `Table`, o que rola dentro do card mas não
  cumpre "tabela vira card no celular" pedido pela spec).
- `Avatar` (`ui/avatar.tsx`, `colorForId`) entra em qualquer linha/card que represente uma PESSOA
  (cliente, profissional) — nunca em serviço. A cor é determinística por `id`, então o mesmo
  cliente/profissional já sai com a mesma cor em qualquer tela (agenda, clientes, profissionais)
  sem nenhum código extra.
- "Carregando…" em texto solto sempre vira `Skeleton` com a MESMA forma do conteúdo real (altura
  de linha de tabela, não um bloco genérico).
- `EmptyState` `variant="highlight"` + ilustração (`empty-illustration.tsx`) só entra quando o
  vazio É a próxima ação óbvia de primeira visita (WhatsApp "conecte o primeiro número", Clientes
  sem filtro nenhum aplicado) — com filtro/busca ativos, a variante continua `neutral` (o vazio ali
  é "ajuste o filtro", não "comece agora"). Duas ilustrações novas: `PeopleEmptyIllustration`,
  `WhatsappEmptyIllustration`.
- Contador com número de destaque (chip `rounded-full ring-1 ring-primary/15`) replica o padrão
  já usado em `agenda-client.tsx` — não inventar um estilo de chip novo.
- `PageHeader.title` foi alargado de `string` para `React.ReactNode` (`ui/page-header.tsx`) para
  caber um `Avatar` ao lado do nome no detalhe de Profissional — decisão de API, não estética;
  qualquer chamador que já passa string continua funcionando sem mudança.
- Status do WhatsApp: o ponto pulsante do card de instância (`whatsapp-instance-card.tsx`) só
  pulsa em `CONNECTED`, mesmo critério do chip "ao vivo" da topbar (`whatsapp-status-chip.tsx`) —
  os dois precisam concordar (um pulsando e o outro não para o mesmo status seria inconsistente).

Ver também [[bug-icone-server-para-client]] (mesma armadilha vale para `StatCard`, não reaberta
aqui) e [[sistema-de-temas-tailwind-v4]] para a mecânica de tokens por tema.

**Login/rate limit em screenshot de verificação**: um único script Playwright que loga UMA vez,
salva o contexto autenticado e reutiliza a MESMA página para trocar de tema
(`/configuracoes/aparencia`, clicar no `input[type=radio][value=TEMA]` com `force: true` porque é
`sr-only`, depois `getByRole('button', {name:'Salvar tema'})`) e navegar entre as 5 telas cobre os
20 prints (3 temas × 5 telas em 1440 + 5 telas em 390 no Índigo) com só 1-2 logins — não abrir uma
sessão nova por print.
