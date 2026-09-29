import { cva, type VariantProps } from "class-variance-authority";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      // Ring colorido (docs/design/premium-spec.md §5/§8) — legível mesmo em zoom/print, sem
      // token novo: `ring-{cor}/25` funciona direto sobre os tokens sólidos que já existem
      // (success/warning/danger/primary), só `neutral` mantém a borda simples de sempre.
      variant: {
        neutral: "bg-bg text-text-secondary border border-border",
        primary: "bg-primary/10 text-primary ring-1 ring-primary/25",
        success: "bg-success-bg text-success ring-1 ring-success/25",
        warning: "bg-warning-bg text-warning ring-1 ring-warning/25",
        danger: "bg-danger-bg text-danger ring-1 ring-danger/25",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
