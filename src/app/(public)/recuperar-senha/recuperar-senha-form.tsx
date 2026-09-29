"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { requestPasswordResetAction } from "@/modules/signup/actions";
import { Mail } from "lucide-react";
import { AuthInput } from "@/components/public/auth-input";
import { AUTH_SUBMIT_CLASS, AuthPanel } from "@/components/public/auth-panel";

export function RecuperarSenhaForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email: email.trim() });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setDone(true);
    });
  }

  if (done) {
    return (
      <AuthPanel>
          <EmptyState
            icon={MailCheck}
            title="Verifique seu e-mail"
            description="Se esse e-mail existir na nossa base, enviamos um link para redefinir a senha. Ele vale por 1 hora."
            action={
              <Button asChild variant="secondary">
                <Link href="/login">Voltar para o login</Link>
              </Button>
            }
          />
        </AuthPanel>
    );
  }

  return (
    <AuthPanel title="Recuperar senha" description="Informe o e-mail da sua conta para receber um link de redefinição.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Field label="E-mail" htmlFor="email" required>
            {(fieldProps) => (
              <AuthInput
                {...fieldProps}
                icon={Mail}
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={!!error}
              />
            )}
          </Field>
          <Button type="submit" size="lg" isLoading={isPending} className={AUTH_SUBMIT_CLASS}>
            Enviar link
          </Button>
          <p className="text-center text-sm text-text-secondary">
            <Link href="/login" className="text-primary hover:underline">
              Voltar para o login
            </Link>
          </p>
        </form>
      </AuthPanel>
  );
}
