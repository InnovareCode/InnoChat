---
name: sistema-de-temas-tailwind-v4
description: Como o InnoChat implementa os 3 temas prontos (Tenant.theme) em runtime com Tailwind v4 — arquitetura de tokens, arquivos envolvidos e a pendência de cor de alerta do Âmbar Estúdio
metadata:
  type: project
---

Implementado em 2026-09-28 (Fase 1, junto com o shell do painel e o login).
Ver [[direcao-visual-proposta]] para a origem das 3 direções e a decisão do
dono de virarem temas prontos por empresa.

**Arquitetura (não redescobrir isso em sessões futuras):**
- `src/app/globals.css` — `@theme` do Tailwind v4 mapeia tokens semânticos
  (`--color-primary`, `--radius-card`, `--shadow-card`, `--font-display`,
  `--spacing-density`...) para variáveis `--panel-*`, que só existem dentro
  de cada bloco `[data-theme="..."]`. Isso permite trocar de tema **sem
  recompilar CSS** — o navegador resolve a cadeia de `var()` em runtime.
  Nenhum componente usa hex/rem de raio/nome de fonte fixo.
- `src/app/fonts.ts` — os 4 pares tipográficos (Inter, Manrope, Fraunces,
  Sora) são carregados uma única vez via `next/font/google` e expostos como
  classes de variável (`fontVariables`) aplicadas no `<html>` dos 3 root
  layouts. Qual variável cada tema usa de fato é decidido em `globals.css`
  (`--panel-font-display`/`--panel-font-body`), não no componente.
- **3 root layouts** (`src/app/(public)/layout.tsx`,
  `src/app/(app)/[tenantSlug]/layout.tsx`, `src/app/(platform)/admin/layout.tsx`)
  — não existe `src/app/layout.tsx` compartilhado. É o padrão "multiple root
  layouts" do App Router: cada grupo de topo define seu próprio `<html>`
  porque cada um resolve `data-theme` de um jeito diferente (fixo Índigo
  para público/admin, dinâmico por `Tenant.theme` para o painel). O tema do
  tenant é resolvido no SERVIDOR (`getPrisma().tenant.findUnique` dentro do
  layout, antes de renderizar) — sem flash de tema errado.

**Pendência registrada, não decisão minha:** `docs/design/direcoes.md` não
definia uma cor de "Alerta" para Âmbar Estúdio (só Índigo e Verde Slate
tinham essa linha na tabela). Usei `#7A4A12` sobre `#F5E3C4` (contraste
~5.7:1, mesma paridade AA das outras duas) como valor derivado da paleta
terracota. Se o dono validar a direção visual formalmente, confirmar essa
cor com ele.

**Como verificar visualmente:** rodar a bateria de screenshots (ver
`docs/design/screens/`, gerada com Playwright headed, login real + troca de
`Tenant.theme` via script ad-hoc) — os 3 temas renderizam fonte, cor e raio
visivelmente diferentes, sem overflow horizontal em 1440px/390px.
