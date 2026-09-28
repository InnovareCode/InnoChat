import { cva, type VariantProps } from "class-variance-authority";

/**
 * Variantes do Button. Alvo mínimo de toque de 40px (`h-10`) em todas as
 * variantes de tamanho, exceto `icon` (40×40). Cores sempre pelos tokens
 * semânticos do tema ativo (`globals.css`) — nunca hex fixo.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card text-sm font-medium " +
    "transition-colors disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-strong",
        secondary: "bg-surface text-text border border-border hover:bg-bg",
        outline: "border border-border bg-transparent text-text hover:bg-bg",
        ghost: "bg-transparent text-text hover:bg-bg",
        danger: "bg-danger text-white hover:opacity-90",
        link: "bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        // Alvo mínimo de toque de 40px em TODAS as variantes de tamanho —
        // "sm" varia o padding/texto, nunca a altura (ver DoD de
        // acessibilidade do kit de componentes).
        sm: "h-10 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
