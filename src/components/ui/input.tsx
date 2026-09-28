import { forwardRef } from "react";
import { cn } from "@/components/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

/** Alvo de toque de 40px (`h-10`). Sempre usar com `<Label htmlFor>` (ver `label.tsx`). */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text",
        "placeholder:text-text-secondary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid && "border-danger",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
