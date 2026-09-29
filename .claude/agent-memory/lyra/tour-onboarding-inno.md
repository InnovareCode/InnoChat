---
name: tour-onboarding-inno
description: Como o tour guiado do Inno e o checklist foram montados (spotlight próprio, data-tour, geometria pura testável) e as armadilhas que apareceram na medição.
metadata:
  type: project
---

Tour + checklist do Inno vivem em `src/components/onboarding/` (falas só em `inno-script.ts`). Alvos do spotlight
são `data-tour="..."` nos elementos reais do shell; lógica/posição em módulos puros (`tour-logic.ts`,
`tour-geometry.ts`) testados no vitest node (sem jsdom/testing-library no projeto; `renderToStaticMarkup` cobre o balão).

Armadilhas medidas no navegador:
- `scrollIntoView` num item da sidebar rolou o DOCUMENTO (sidebar não é sticky) e escondeu o brand: rolar só se
  o alvo estiver fora da tela, depois da animação dos grupos, e `scrollTo(0)` ao abrir.
- `overflow-y-auto` no balão cortava a "ponta" (tail): overflow só no miolo, nunca no contêiner com o tail.
- Alvo mais alto que a tela (sidebar em página longa): recortar o retângulo pela viewport antes de posicionar o balão.
- Radix Dialog (gaveta mobile) devolve o foco ao fechar e rouba o foco do balão: refocar em 150/450 ms e fechar a gaveta via evento `innochat:close-mobile-nav`.
- Devolver foco ao fechar com `focus({ preventScroll: true })`, senão a página rola até o botão "Rever tour" no rodapé.
- PageTransition (pré-existente) gera hydration mismatch com `prefers-reduced-motion: reduce` (wrapper motion.div só no servidor).
