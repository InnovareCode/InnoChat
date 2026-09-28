import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/components/lib/cn";
import { buttonVariants, type ButtonVariants } from "./button.variants";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  ButtonVariants & {
    /** Renderiza as props no filho em vez de um `<button>` (ex.: um `<a>`/`Link`). */
    asChild?: boolean;
    /** Mostra um spinner e desabilita o botão — usar durante submissão de formulário. */
    isLoading?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, isLoading, disabled, children, ...props }, ref) => {
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
        {isLoading ? (
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
