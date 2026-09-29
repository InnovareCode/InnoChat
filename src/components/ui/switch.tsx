import { forwardRef } from "react";
import { cn } from "@/components/lib/cn";

export type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "role"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/**
 * Interruptor ligar/desligar (`role="switch"`). Alvo de toque de 44px (a "trilha" visível é
 * menor, o botão em volta é que cobre a área). Nome acessível: passe `aria-labelledby` ou
 * `aria-label`; texto de apoio em `aria-describedby`. Só tokens de cor — vale nos 3 temas.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-11 w-16 shrink-0 items-center justify-center rounded-full",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative h-7 w-12 rounded-full border transition-colors motion-reduce:transition-none",
          checked ? "border-primary bg-primary" : "border-border bg-bg",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-card transition-[left] motion-reduce:transition-none",
            checked ? "left-6" : "left-0.5",
          )}
        />
      </span>
    </button>
  ),
);
Switch.displayName = "Switch";
