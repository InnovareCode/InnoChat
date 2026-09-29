"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { installPlatformAdminAction } from "@/modules/platform/install-actions";
import { KeyRound, Lock, Mail, User } from "lucide-react";
import { AuthInput } from "@/components/public/auth-input";
import { AUTH_SUBMIT_CLASS, AuthPanel } from "@/components/public/auth-panel";

/**
 * Formulário mínimo — a Lyra cuida do polimento visual. O contrato com a Server Action é o que
 * importa aqui: `{ code, name, email, password }` → `installPlatformAdminAction`.
 */

type FormState = { code: string; name: string; email: string; password: string; confirmPassword: string };
const EMPTY_FORM: FormState = { code: "", name: "", email: "", password: "", confirmPassword: "" };

export function InstalacaoForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function validateClientSide(): boolean {
    const errors: Record<string, string> = {};
    if (form.code.trim().length < 10) errors.code = "Informe o código de instalação impresso no log do servidor.";
    if (form.name.trim().length < 2) errors.name = "Informe seu nome.";
    if (!form.email.includes("@")) errors.email = "Informe um e-mail válido.";
    if (form.password.length < 8) errors.password = "A senha precisa ter pelo menos 8 caracteres.";
    if (form.password !== form.confirmPassword) errors.confirmPassword = "As senhas não são iguais.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validateClientSide()) return;

    startTransition(async () => {
      const result = await installPlatformAdminAction({
        code: form.code.trim(),
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });

      if (!result.ok) {
        if (result.error.code === "INSTALL_CODE_INVALID") {
          setFieldErrors((prev) => ({ ...prev, code: result.error.message }));
          return;
        }
        if (result.error.code === "EMAIL_TAKEN") {
          setFieldErrors((prev) => ({ ...prev, email: "Já existe uma conta com este e-mail." }));
          return;
        }
        setFormError(result.error.message);
        return;
      }

      router.push("/login?instalado=1");
    });
  }

  return (
    <AuthPanel title="Instalar o InnoChat" description={<>Crie a conta de administrador da plataforma. O código de instalação aparece no log do container do
          painel no Easypanel (procure por &ldquo;InnoChat: código de instalação&rdquo;) e vale por 24 horas.</>}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {formError ? <Alert variant="danger">{formError}</Alert> : null}

          <Field
            label="Código de instalação"
            htmlFor="code"
            required
            error={fieldErrors.code}
            hint={!fieldErrors.code ? "Log do container do painel no Easypanel, impresso quando ele sobe." : undefined}
          >
            {(fieldProps) => (
              <AuthInput
                {...fieldProps}
                icon={KeyRound}
                name="code"
                autoComplete="off"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                maxLength={200}
                invalid={!!fieldErrors.code}
              />
            )}
          </Field>

          <Field label="Seu nome" htmlFor="name" required error={fieldErrors.name}>
            {(fieldProps) => (
              <AuthInput
                {...fieldProps}
                icon={User}
                name="name"
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={120}
                invalid={!!fieldErrors.name}
              />
            )}
          </Field>

          <Field label="E-mail" htmlFor="email" required error={fieldErrors.email}>
            {(fieldProps) => (
              <AuthInput
                {...fieldProps}
                icon={Mail}
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                invalid={!!fieldErrors.email}
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Senha" htmlFor="password" required error={fieldErrors.password}>
              {(fieldProps) => (
                <AuthInput
                  {...fieldProps}
                  icon={Lock}
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  invalid={!!fieldErrors.password}
                />
              )}
            </Field>
            <Field label="Confirmar senha" htmlFor="confirmPassword" required error={fieldErrors.confirmPassword}>
              {(fieldProps) => (
                <AuthInput
                  {...fieldProps}
                  icon={Lock}
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  invalid={!!fieldErrors.confirmPassword}
                />
              )}
            </Field>
          </div>

          <Button type="submit" size="lg" isLoading={isPending} className={AUTH_SUBMIT_CLASS} loadingText="Concluindo…">
            Concluir instalação
          </Button>
        </form>
      </AuthPanel>
  );
}
