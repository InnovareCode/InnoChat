---
name: bug-icone-server-para-client
description: Nunca passar um componente de ícone (LucideIcon) como prop de Server para Client Component — sempre um elemento já renderizado.
metadata:
  type: feedback
---

Passar o **componente** de ícone (`icon: LucideIcon`, ex. `icon={CalendarClock}`) como prop de
um Server Component para um Client Component quebra o build: "Only plain objects can be passed
to Client Components from Server Components. Classes or other objects with methods are not
supported." Funções (componentes React) não são serializáveis através da fronteira RSC.

**Onde já mordeu:**
1. `nav-items.ts`/`sidebar-nav.tsx` (Fase de shell inicial) — resolvido fazendo os arrays de
   navegação (com ícone) serem importados DENTRO do próprio Client Component, nunca recebidos
   como prop vinda de fora.
2. `stat-card.tsx` (docs/design/premium-spec.md, protótipo "Início") — `StatCard` é Client
   Component (`motion.div`, `AnimatedCounter`) e é chamado a partir de `inicio/page.tsx`, que é
   Server Component. Pego em produção só ao MEDIR no navegador (a skill
   `medir-antes-de-afirmar` funcionou: o erro só apareceu na primeira screenshot, típico "Only
   plain objects...").

**Correção (padrão a repetir):** quando o consumidor é Server e o componente-alvo é Client,
NUNCA receber `icon: LucideIcon`. Duas saídas válidas, escolher pela forma de uso:
- O array/objeto com o ícone nasce e é consumido inteiramente dentro do MESMO Client Component
  (caso da navegação) — o Server nunca vê o ícone.
- O Server precisa escolher QUAL ícone por instância (caso do `StatCard`, cada card tem um ícone
  diferente escolhido pela página) — nesse caso a prop é `icon: React.ReactNode`, o Server já
  manda o elemento RENDERIZADO (`icon={<CalendarClock aria-hidden="true" />}`, sem classe de
  tamanho fixa), e o Client controla o tamanho via wrapper (`[&>svg]:h-24 [&>svg]:w-24`) — o
  mesmo elemento pode ser reaproveitado duas vezes na árvore (selo pequeno + decorativo gigante)
  sem duplicar a prop.

**Como não cair de novo:** ao criar QUALQUER componente `"use client"` com prop de ícone, primeiro
perguntar "quem chama isto é Server ou Client?" — se Server, a prop é sempre elemento, nunca
componente.

**Mesma família de bug, achado na sequência (`StatCard`, `format?: (n) => string`):** função
também não atravessa a fronteira Server→Client ("Functions cannot be passed directly to Client
Components unless you explicitly expose it by marking it with 'use server'."). Corrigido trocando
`format: (n) => string` por um dado serializável simples (`suffix?: string`, ex. `"%"`) — regra
geral: qualquer prop de um Client Component chamado a partir de Server só pode ser dado plano
(string/number/boolean/array/objeto simples) ou `ReactNode` já renderizado, nunca função nem
componente. As duas vezes que essa classe de erro apareceu só foi pega ao MEDIR no navegador
(tela de erro do Next), nunca no `tsc`/build — reforça a skill `medir-antes-de-afirmar`.
