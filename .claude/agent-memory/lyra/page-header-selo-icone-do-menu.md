---
name: page-header-selo-icone-do-menu
description: PageHeader tem selo de ícone vindo de navIconFor (nav-items.ts), fonte única com o menu; regra para páginas novas.
metadata:
  type: project
---

`PageHeader` aceita `icon` (selo 44px, hero 56px, `bg-primary/10`, `rounded-card`, `sm:flex`). O ícone vem SEMPRE de
`navIconFor(chave)` em `shell/nav-items.ts` (chave tenant = segmento da rota; admin = `admin/xxx`; subpáginas usam a
seção-mãe; chave desconhecida lança). Página nova: passar `icon={navIconFor("...")}`, nunca importar lucide à mão.
Selo é centrado no bloco título+descrição; botão de ação continua alinhado ao topo do título (items-start).
**Why:** pedido do dono (padrão Parque das Feiras). Medido em 1440/390 em 2026-09-29.
