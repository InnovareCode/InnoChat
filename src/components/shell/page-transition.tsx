"use client";

import { usePathname } from "next/navigation";

/**
 * Entrada suave da página nova (docs/design/premium-spec.md §7/§11) — fade + subida de 6px em
 * 200ms, chaveada por `pathname` para reiniciar a cada troca de rota. Envolve `{children}` uma
 * única vez no shell; nenhuma página precisa saber que isso existe.
 *
 * Só CSS (`.page-enter`, globals.css), sem framer-motion. O bug anterior: `useReducedMotion()`
 * devolve `null` no servidor e o valor real no cliente, então com `prefers-reduced-motion:
 * reduce` o servidor renderizava um `motion.div` e o cliente não (hydration mismatch). Agora o
 * markup é idêntico nos dois lados e a media query `no-preference` da própria regra CSS desliga
 * o movimento. Não há animação de saída: com `loading.tsx` o skeleton precisa aparecer na hora,
 * sem esperar a página antiga sumir.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
