import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/lib/cn";

export type PageHeaderProps = {
  /** Normalmente uma string; aceita `ReactNode` para os casos em que o título carrega um avatar
   * ao lado do nome (ex.: detalhe de profissional) — sem criar uma segunda prop só para isso. */
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  /** `hero` (docs premium, ajuste tipográfico pedido pelo dono): só a tela "Início" — ~40px,
   * tracking apertado (`-0.02em`). Telas de trabalho diário (Agenda etc.) ficam no `default`
   * (28px "contido", pedido explícito do dono — não é o `text-2xl`/24px antigo, subiu 4px). */
  size?: "default" | "hero";
  /** Ícone da seção — SEMPRE o mesmo do menu lateral (`navIconFor(...)` em `shell/nav-items.ts`),
   * para o cabeçalho confirmar onde a pessoa está. Selo some no mobile (`sm:flex`): ali o espaço
   * vale mais para o título e o ícone já aparece no menu. */
  icon?: LucideIcon;
};

export function PageHeader({ title, description, action, className, size = "default", icon: Icon }: PageHeaderProps) {
  const hero = size === "hero";
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 items-center gap-3.5">
        {Icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "hidden shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary sm:flex",
              hero ? "h-14 w-14" : "h-11 w-11",
            )}
          >
            <Icon className={hero ? "h-7 w-7" : "h-5 w-5"} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h1
            className={cn(
              "font-display text-text",
              hero
                ? "text-[2.5rem] font-black leading-none tracking-[-0.02em]"
                : "text-[1.75rem] font-bold leading-tight",
            )}
          >
            {title}
          </h1>
          {description ? <p className="mt-1.5 text-sm text-text-secondary">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
