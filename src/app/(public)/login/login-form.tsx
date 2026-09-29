"use client";

import { useActionState } from "react";
import { Lock, Mail } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { AuthInput } from "@/components/public/auth-input";
import { AUTH_SUBMIT_CLASS, AuthTrust } from "@/components/public/auth-panel";
import { loginAction, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = { error: null };

export function LoginForm({ forgotLink }: { forgotLink: React.ReactNode }) {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <Field label="E-mail" htmlFor="email" required>
        {(fieldProps) => (
          <AuthInput
            {...fieldProps}
            icon={Mail}
            type="email"
            name="email"
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            required
            invalid={!!state.error}
          />
        )}
      </Field>

      <Field label="Senha" htmlFor="password" required labelAction={forgotLink}>
        {(fieldProps) => (
          <AuthInput
            {...fieldProps}
            icon={Lock}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            invalid={!!state.error}
          />
        )}
      </Field>

      <Button type="submit" size="lg" isLoading={isPending} className={AUTH_SUBMIT_CLASS} loadingText="Entrando…">
        Entrar
      </Button>
      <AuthTrust />
    </form>
  );
}
