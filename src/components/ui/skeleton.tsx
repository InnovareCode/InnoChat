import { cn } from "@/components/lib/cn";

/**
 * Placeholder de carregamento com shimmer (docs premium, pacote "movimento e carregamento") —
 * substitui texto solto ("Carregando…") por um bloco na forma do conteúdo real. `skeleton-shimmer`
 * (globals.css) desliga a animação com `prefers-reduced-motion`, ficando só o tom sólido.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-card", className)} aria-hidden="true" />;
}
