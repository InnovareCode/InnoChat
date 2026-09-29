import { cn } from "@/components/lib/cn";

/**
 * Loader padrão de ações (salvar, gerar QR, sincronizar…) — o ÚNICO spinner do produto.
 * Anel na cor atual do texto (`currentColor`) com um arco visível; gira via `.spinner-ring`
 * (globals.css), que fica parado com `prefers-reduced-motion`. Decorativo (`aria-hidden`):
 * quem usa deve comunicar a espera em texto ("Salvando…") ou no `aria-busy` do contêiner.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "spinner-ring inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
