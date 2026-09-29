"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save, User } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updateMyAccountAction } from "@/modules/auth/account-actions";

export const ACCOUNT_NAME_MIN = 2;
export const ACCOUNT_NAME_MAX = 80;

/**
 * Edição do nome de exibição (mesma tela no painel da empresa e no admin da plataforma). O e-mail
 * é só leitura — trocar e-mail exigiria reconfirmação, fora do escopo desta fase. Depois de salvar,
 * `router.refresh()` reexecuta o layout: o bloco do usuário na sidebar e a saudação do Início já
 * saem com o nome novo, sem F5.
 */
export function MinhaContaForm({ initialName, email }: { initialName: string | null; email: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const [savedName, setSavedName] = useState(initialName ?? "");
  const [name, setName] = useState(initialName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = name.trim() !== savedName.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < ACCOUNT_NAME_MIN) {
      setError(`Informe seu nome (pelo menos ${ACCOUNT_NAME_MIN} letras).`);
      return;
    }
    if (trimmed.length > ACCOUNT_NAME_MAX) {
      setError(`O nome pode ter no máximo ${ACCOUNT_NAME_MAX} caracteres.`);
      return;
    }
    startTransition(async () => {
      const result = await updateMyAccountAction({ name: trimmed });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      const next = result.data.name ?? trimmed;
      setSavedName(next);
      setName(next);
      notify({ variant: "success", title: "Nome atualizado." });
      router.refresh();
    });
  }

  return (
    <Card className="max-w-2xl rounded-hero">
      <CardHeader>
        <CardTitle>Seus dados</CardTitle>
        <CardDescription>O nome aparece na saudação do Início e no menu lateral.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Seu nome" htmlFor="account-name" required error={error}>
            {(fieldProps) => (
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
                  aria-hidden="true"
                />
                <Input
                  {...fieldProps}
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={ACCOUNT_NAME_MAX}
                  invalid={!!error}
                  className="pl-9"
                />
              </div>
            )}
          </Field>

          <Field
            label="E-mail"
            htmlFor="account-email"
            hint="É o e-mail que você usa para entrar. Não pode ser alterado aqui."
          >
            {(fieldProps) => (
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
                  aria-hidden="true"
                />
                <Input
                  {...fieldProps}
                  type="email"
                  value={email}
                  readOnly
                  aria-readonly="true"
                  className="bg-bg pl-9 text-text-secondary"
                />
              </div>
            )}
          </Field>

          <div className="flex justify-end">
            <Button type="submit" icon={Save} isLoading={isPending} loadingText="Salvando…" disabled={!dirty}>
              Salvar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
