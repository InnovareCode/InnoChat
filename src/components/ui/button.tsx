import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/lib/cn";
import { buttonVariants, type ButtonVariants } from "./button.variants";
import { Spinner } from "./spinner";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    /** Renderiza as props no filho em vez de um `<button>` (ex.: um `<a>`/`Link`). */
    asChild?: boolean;
    /** Mostra um spinner e desabilita o botão — usar durante submissão de formulário. */
    isLoading?: boolean;
    /** Texto exibido no lugar do rótulo enquanto `isLoading` ("Salvando…"). Sem ele o rótulo
     * original é mantido ao lado do spinner. Nunca use em botão que um teste E2E relocaliza pelo
     * nome DURANTE o carregamento. */
    loadingText?: string;
    /** Ícone lucide à esquerda do rótulo (16px, `aria-hidden`, gap padrão do botão). Some enquanto
     * `isLoading` (o spinner ocupa o lugar — nunca os dois juntos). Não muda o nome acessível.
     * Ignorado com `asChild` (ponha o ícone dentro do filho). Botão só de ícone: use `size="icon"`
     * com `aria-label`, sem esta prop. */
    icon?: LucideIcon;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, isLoading, loadingText, icon: Icon, disabled, children, ...props }, ref) => {
    // `Slot` (asChild) exige exatamente um elemento filho — nunca some junto
    // um spinner condicional. `asChild` é para links/`Link`, que não têm
    // estado de carregamento próprio; `isLoading` só se aplica ao `<button>`.
    if (asChild) {
      return (
        <Slot ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? <Spinner /> : Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        {isLoading && loadingText ? loadingText : children}
      </button>
    );
  },
);
Button.displayName = "Button";
