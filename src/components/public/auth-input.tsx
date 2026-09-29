"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Input, type InputProps } from "@/components/ui/input";
import { cn } from "@/components/lib/cn";

type AuthInputProps = InputProps & {
  /** Ícone dentro do campo (decorativo — o `<label>` continua sendo o nome acessível). */
  icon?: LucideIcon;
};

/**
 * Campo das telas de autenticação: 48px de altura, ícone à esquerda, anel primário no foco e, para
 * `type="password"`, botão de mostrar/ocultar. Envolve o `Input` do kit, então `id`,
 * `aria-describedby`, `aria-invalid` e `name` chegam sem mudança (o `Field` continua dono do label).
 *
 * O rótulo do botão de senha NÃO contém a palavra "senha": os testes E2E localizam o campo por
 * `getByLabel("Senha")` (substring) e um segundo elemento casando quebraria o modo estrito.
 */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
  ({ icon: Icon, type, className, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
        ) : null}
        <Input
          ref={ref}
          type={isPassword && revealed ? "text" : type}
          className={cn(
            "h-12 border-text-secondary/70 bg-surface text-base transition-shadow sm:text-sm",
            "hover:border-primary/60",
            "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
            Icon && "pl-11",
            isPassword && "pr-12",
            className,
          )}
          {...props}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            aria-label={revealed ? "Ocultar o texto digitado" : "Mostrar o texto digitado"}
            className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-card text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
          >
            {revealed ? <EyeOff className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" /> : <Eye className="h-[1.125rem] w-[1.125rem]" aria-hidden="true" />}
          </button>
        ) : null}
      </div>
    );
  },
);
AuthInput.displayName = "AuthInput";
