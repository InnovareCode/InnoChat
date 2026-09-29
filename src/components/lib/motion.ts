/**
 * Tokens de motion (docs/design/premium-spec.md §7). Centraliza os números para não repetir
 * "0.08s" em 5 arquivos — qualquer ajuste de ritmo entra aqui uma vez só.
 *
 * Todo consumidor deve checar `useReducedMotion()` (framer-motion) antes de aplicar qualquer
 * um destes valores — os componentes que usam isto já fazem essa checagem local (não dá para
 * centralizar o hook aqui porque cada `motion.div` decide sozinho suas props).
 */

/** Delay por item em entrada escalonada de grade (StatCards) — meio-termo entre o guia (0.04s)
 * e o código real (0.1s) da referência MultMarkets. */
export const STAGGER_DELAY_S = 0.08;

/** Transição de entrada padrão (fade + subida leve) usada em StatCard e na transição de página. */
export const FADE_UP_TRANSITION = { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };

/** Estado inicial/final do fade+subida — reaproveitado por `StatCard` e `PageTransition`. */
export const fadeUpVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/** Spring de hover/tap em itens de navegação (§2/§7) — igual ao já validado no InnoAtendente. */
export const NAV_HOVER_SPRING = { type: "spring" as const, stiffness: 400, damping: 25 };
