import { cn } from "@/components/lib/cn";

/**
 * Bloco de carregamento — o único componente de skeleton do produto (docs premium, pacote
 * "movimento e carregamento"). Sempre com a MESMA forma/altura do conteúdo real, para a troca não
 * gerar layout shift. `skeleton-shimmer` (globals.css) usa só tokens do tema e fica estático com
 * `prefers-reduced-motion`. Decorativo: o contêiner que carrega é que leva `aria-busy`.
 *
 * `rounded-card` é o padrão; passe `rounded-hero`, `rounded-full` etc. para casar com o alvo.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-card", className)} aria-hidden="true" />;
}
