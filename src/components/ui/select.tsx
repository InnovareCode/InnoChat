import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/components/lib/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

/**
 * `<select>` nativo estilizado (não Radix): já é acessível por padrão
 * (teclado, leitor de tela, autofill do navegador) e cobre os selects do
 * painel (plano, tema, profissional…) sem o custo de um Radix Select.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-10 w-full appearance-none rounded-card border border-border bg-surface px-3 pr-9 text-sm text-text",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          invalid && "border-danger",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
      />
    </div>
  ),
);
Select.displayName = "Select";
