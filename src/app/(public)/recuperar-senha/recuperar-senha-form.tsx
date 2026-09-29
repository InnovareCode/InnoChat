"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { requestPasswordResetAction } from "@/modules/signup/actions";

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
      <Card className="rounded-hero">
        <CardContent className="pt-5">
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
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-hero">
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Informe o e-mail da sua conta para receber um link de redefinição.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Field label="E-mail" htmlFor="email" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
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
          <Button type="submit" isLoading={isPending}>
            Enviar link
          </Button>
          <p className="text-center text-sm text-text-secondary">
            <Link href="/login" className="text-primary hover:underline">
              Voltar para o login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
