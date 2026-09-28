import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/lib/cn";

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Estado vazio padrão do painel — usado tanto para "sem dados ainda" quanto
 * para as páginas placeholder das telas que a Vega ainda vai alimentar
 * (nunca uma tela em branco sem explicação).
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-card border border-dashed border-border p-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg text-text-secondary">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      ) : null}
      <p className="font-display text-base font-bold text-text">{title}</p>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-text-secondary">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
