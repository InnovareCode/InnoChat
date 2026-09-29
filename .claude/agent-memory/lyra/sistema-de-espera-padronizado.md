---
name: sistema-de-espera-padronizado
description: Como o InnoChat mostra espera (barra de topo, loading.tsx com skeleton por seção, Spinner/Button loadingText, PageTransition só CSS, Inno após 1,5s) e as armadilhas medidas.
metadata:
  type: project
---

Peças (2026-09-29): `shell/navigation-progress.tsx` (barra 3px, listener de clique em `<a>` interno,
aparece só após 120ms, completa quando `usePathname/useSearchParams` mudam; montada nos layouts raiz
`[tenantSlug]/layout.tsx` e `admin/layout.tsx`, NÃO nos shells), `loading/page-loading.tsx` (casca:
`PageHeader` REAL + `aria-busy` + "Carregando…" sr-only + `InnoWaitHint`), `loading/parts.tsx`
(peças de skeleton com as medidas dos componentes reais), `ui/spinner.tsx`, `Button loadingText`.

- **Cabeçalho do skeleton é o real** (título/descrição/selo): zero shift e informa onde a pessoa está.
  Descrição dinâmica (Agenda = fuso do tenant) vira `<span skeleton>` — `PageHeader.description` é ReactNode.
- **Medir skeleton x real** com spec temporária Playwright (rota debug `zz-debug` renderizando o loading.tsx
  dentro do shell): chip 26px, filtro 104px (4 campos em lg), StatCard 204px, linha do header 88+61 batem.
  Alturas de tabela/grade dependem de dados; ajustar só a ordem de grandeza.
- **PageTransition**: bug era `useReducedMotion()` (null no servidor) trocando `motion.div` por fragmento →
  hydration mismatch. Agora só CSS (`.page-enter` em `prefers-reduced-motion: no-preference`), sem exit
  animation (AnimatePresence mode="wait" atrasaria o skeleton).
- **Barra e `loading.tsx`**: a rota "confirma" quando o skeleton entra, então a barra completa aí (não no
  conteúdo final). `router.push` programático não arma a barra.
- **loadingText** só em botões cujo teste não relocaliza pelo nome durante a espera; sem `loadingText` o
  rótulo original fica (nome acessível estável).
- **Login E2E**: rate limit em memória do `next dev` (IP 20/5min, e-mail 8/15min). Cada `playwright test`
  = 3 logins no global-setup; várias rodadas seguidas derrubam o setup ("toHaveURL /studio-demo" falha em
  /login). Juntar specs numa invocação só e esperar a janela.
- `next build` (Turbopack) recusa com "Another next build process is already running" se outra instância
  estiver construindo; `.next/dev` é separado do `.next` de build, então rodar build com dev ligado é seguro.
