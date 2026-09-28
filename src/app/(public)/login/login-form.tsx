"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { loginAction, type LoginState } from "./actions";

const INITIAL_STATE: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}

      <Field label="E-mail" htmlFor="email" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="email"
            name="email"
            autoComplete="email"
            required
            invalid={!!state.error}
          />
        )}
      </Field>

      <Field label="Senha" htmlFor="password" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            invalid={!!state.error}
          />
        )}
      </Field>

      <Button type="submit" isLoading={isPending} className="mt-1">
        Entrar
      </Button>
    </form>
  );
}
