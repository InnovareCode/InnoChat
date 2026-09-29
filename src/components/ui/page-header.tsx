import { cn } from "@/components/lib/cn";

export type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** `hero` (docs premium, ajuste tipográfico pedido pelo dono): só a tela "Início" — ~40px,
   * tracking apertado (`-0.02em`). Telas de trabalho diário (Agenda etc.) ficam no `default`
   * (28px "contido", pedido explícito do dono — não é o `text-2xl`/24px antigo, subiu 4px). */
  size?: "default" | "hero";
};

export function PageHeader({ title, description, action, className, size = "default" }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <h1
          className={cn(
            "font-display text-text",
            size === "hero"
              ? "text-[2.5rem] font-black leading-none tracking-[-0.02em]"
              : "text-[1.75rem] font-bold leading-tight",
          )}
        >
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
