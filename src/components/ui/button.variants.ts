import { cva, type VariantProps } from "class-variance-authority";

/**
 * Variantes do Button. Alvo mínimo de toque de 44px (`h-11`, requisito reforçado do dono
 * 2026-09-29: "alvos de toque de 44px ou mais no celular") em TODAS as variantes de tamanho —
 * subiu de 40px (`h-10`), mesma altura em todo breakpoint (não é condicional por tela: mais
 * simples de manter e 44px também é confortável no desktop). Cores sempre pelos tokens
 * semânticos do tema ativo (`globals.css`) — nunca hex fixo.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card text-sm font-medium " +
    "transition-[background-color,color,transform] duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-strong",
        secondary: "bg-surface text-text border border-border hover:bg-bg",
        outline: "border border-border bg-transparent text-text hover:bg-bg",
        ghost: "bg-transparent text-text hover:bg-bg",
        danger: "bg-danger text-white hover:opacity-90",
        success: "bg-success text-white hover:opacity-90",
        // Tintado (não sólido): texto branco sobre âmbar não passa AA em todos os temas.
        warning: "border border-warning/30 bg-warning-bg text-warning hover:bg-warning/15",
        link: "bg-transparent text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        // "sm" varia o padding/texto, nunca a altura (ver DoD de acessibilidade do kit de
        // componentes) — todas as variantes compartilham o mesmo alvo mínimo de 44px.
        sm: "h-11 px-3 text-sm",
        md: "h-11 px-4",
        lg: "h-12 px-6 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonVariants = VariantProps<typeof buttonVariants>;
