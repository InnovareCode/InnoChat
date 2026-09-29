import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/lib/cn";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** `highlight` (docs/design/premium-spec.md §8): CTA com gradiente sutil em vez da borda
   * tracejada neutra — para os casos em que o vazio É a próxima ação óbvia (ex.: "conecte o
   * primeiro número"), não só "ainda não há dados". Default `neutral` continua o mesmo de sempre. */
  variant?: "neutral" | "highlight";
};

/**
 * Estado vazio padrão do painel — usado tanto para "sem dados ainda" quanto
 * para as páginas placeholder das telas que a Vega ainda vai alimentar
 * (nunca uma tela em branco sem explicação).
 */
export function EmptyState({ icon: Icon, title, description, action, className, variant = "neutral" }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card p-12 text-center",
        variant === "highlight"
          ? "border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent"
          : "border border-dashed border-border",
        className,
      )}
    >
      {Icon ? (
        <div
          className={cn(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-full",
            variant === "highlight" ? "bg-primary/10 text-primary" : "bg-bg text-text-secondary",
          )}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      ) : null}
      <p className="font-display text-base font-bold text-text">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
