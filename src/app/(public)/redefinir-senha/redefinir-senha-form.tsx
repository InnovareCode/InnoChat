"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { resetPasswordAction } from "@/modules/signup/actions";

export function RedefinirSenhaForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link incompleto</CardTitle>
          <CardDescription>Este link de redefinição está sem o código necessário.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/recuperar-senha">Pedir novo link</Link>
          </Button>
        </CardContent>
      </Card>
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
      const result = await resetPasswordAction({ token, password });
      if (!result.ok) {
        setError(
          result.error.code === "TOKEN_INVALID"
            ? "Este link é inválido, já foi usado ou expirou. Peça um novo."
            : result.error.message,
        );
        return;
      }
      router.push("/login?redefinida=1");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redefinir senha</CardTitle>
        <CardDescription>Escolha uma nova senha para sua conta.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error ? (
            <Alert variant="danger">
              {error}
              {error.startsWith("Este link") ? (
                <>
                  {" "}
                  <Link href="/recuperar-senha" className="underline">
                    Pedir novo link
                  </Link>
                </>
              ) : null}
            </Alert>
          ) : null}
          <Field label="Nova senha" htmlFor="password" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
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
          <Field label="Confirmar nova senha" htmlFor="confirmPassword" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
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
          <Button type="submit" isLoading={isPending}>
            Salvar nova senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
