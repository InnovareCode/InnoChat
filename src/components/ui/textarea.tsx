import { forwardRef } from "react";
import { cn } from "@/components/lib/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

/** Mesmo tratamento visual do `Input` (`input.tsx`) — altura mínima de 44px de toque na
 * primeira linha, mas cresce com `rows`. Sempre usar com `<Label htmlFor>`/`<Field>`. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-11 w-full rounded-card border border-border bg-surface px-3 py-2.5 text-sm text-text",
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
Textarea.displayName = "Textarea";
