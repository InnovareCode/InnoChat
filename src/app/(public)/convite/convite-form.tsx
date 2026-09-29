"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { acceptInviteAction } from "@/modules/signup/actions";
import { Lock } from "lucide-react";
import { AuthInput } from "@/components/public/auth-input";
import { AUTH_SUBMIT_CLASS, AuthPanel } from "@/components/public/auth-panel";

export function ConviteForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!token) {
    return (
      <AuthPanel title="Link incompleto" description="Este convite está sem o código necessário. Peça um novo convite a quem te convidou.">
          <Button asChild>
            <Link href="/login">Ir para o login</Link>
          </Button>
        </AuthPanel>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }
    startTransition(async () => {
      const result = await acceptInviteAction({ token, password });
      if (!result.ok) {
        setError(
          result.error.code === "TOKEN_INVALID"
            ? "Este convite é inválido, já foi usado ou expirou. Peça um novo."
            : result.error.message,
        );
        return;
      }
      router.push(result.data.tenantSlug ? `/${result.data.tenantSlug}/inicio` : "/login");
    });
  }

  return (
    <AuthPanel title="Aceitar convite" description="Defina sua senha para entrar no painel da empresa que te convidou.">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error ? <Alert variant="danger">{error}</Alert> : null}
          <Field label="Senha" htmlFor="password" required>
            {(fieldProps) => (
              <AuthInput
                {...fieldProps}
                icon={Lock}
                type="password"
                name="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={!!error}
              />
            )}
          </Field>
          <Field label="Confirmar senha" htmlFor="confirmPassword" required>
            {(fieldProps) => (
              <AuthInput
                {...fieldProps}
                icon={Lock}
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                invalid={!!error}
              />
            )}
          </Field>
          <Button type="submit" size="lg" isLoading={isPending} className={AUTH_SUBMIT_CLASS} loadingText="Entrando…">
            Entrar
          </Button>
        </form>
      </AuthPanel>
  );
}
