"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { slugify, validateSlug, type SlugValidationError } from "@/core/signup/slug";
import { signUpAction } from "@/modules/signup/actions";

const TERMS_VERSION = "1";

const SLUG_ERROR_MESSAGE: Record<SlugValidationError, string> = {
  TOO_SHORT: "O endereço precisa ter pelo menos 3 letras.",
  TOO_LONG: "O endereço pode ter no máximo 60 caracteres.",
  INVALID_FORMAT: "Use só letras minúsculas, números e hífen — sem espaços, acentos ou símbolos.",
  RESERVED: "Esse endereço já é reservado pelo sistema. Escolha outro.",
};

type FormState = {
  companyName: string;
  slug: string;
  slugTouched: boolean;
  segment: string;
  ownerName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

const EMPTY_FORM: FormState = {
  companyName: "",
  slug: "",
  slugTouched: false,
  segment: "",
  ownerName: "",
  email: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

export function CadastroForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const slugValidation = useMemo(() => (form.slug ? validateSlug(form.slug) : null), [form.slug]);

  function handleCompanyNameChange(value: string) {
    setForm((f) => ({
      ...f,
      companyName: value,
      slug: f.slugTouched ? f.slug : slugify(value),
    }));
  }

  function handleSlugChange(value: string) {
    setForm((f) => ({ ...f, slug: slugify(value), slugTouched: true }));
  }

  function validateClientSide(): boolean {
    const errors: Record<string, string> = {};
    if (form.companyName.trim().length < 2) errors.companyName = "Informe o nome da empresa.";
    if (slugValidation) errors.slug = SLUG_ERROR_MESSAGE[slugValidation];
    if (!form.slug) errors.slug = "Escolha um endereço para a empresa.";
    if (form.ownerName.trim().length < 2) errors.ownerName = "Informe seu nome.";
    if (!form.email.includes("@")) errors.email = "Informe um e-mail válido.";
    if (form.password.length < 8) errors.password = "A senha precisa ter pelo menos 8 caracteres.";
    if (form.password !== form.confirmPassword) errors.confirmPassword = "As senhas não são iguais.";
    if (!form.acceptedTerms) errors.acceptedTerms = "É preciso aceitar os termos e a privacidade.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validateClientSide()) return;

    startTransition(async () => {
      const result = await signUpAction({
        companyName: form.companyName.trim(),
        slug: form.slug,
        segment: form.segment.trim() || undefined,
        ownerName: form.ownerName.trim(),
        email: form.email.trim(),
        password: form.password,
        termsVersion: TERMS_VERSION,
        acceptedTerms: form.acceptedTerms,
      });

      if (!result.ok) {
        if (result.error.code === "SLUG_TAKEN") {
          setFieldErrors((prev) => ({ ...prev, slug: "Esse endereço já está em uso. Escolha outro." }));
          return;
        }
        if (result.error.code === "EMAIL_TAKEN") {
          setFieldErrors((prev) => ({ ...prev, email: "Já existe uma conta com este e-mail." }));
          return;
        }
        if (result.error.code === "INVALID_SLUG") {
          setFieldErrors((prev) => ({ ...prev, slug: "Endereço inválido. Ajuste e tente de novo." }));
          return;
        }
        setFormError(result.error.message);
        return;
      }

      setDone({ email: form.email.trim() });
    });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="pt-5">
          <EmptyState
            icon={MailCheck}
            title="Confirme seu e-mail"
            description={`Enviamos um link de confirmação para ${done.email}. Abra sua caixa de entrada (e o spam, por garantia) para ativar a conta.`}
            action={
              <Button asChild variant="secondary">
                <Link href="/login">Ir para o login</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>1 dia de teste grátis. Sem cartão de crédito para começar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {formError ? <Alert variant="danger">{formError}</Alert> : null}

          <Field label="Nome da empresa" htmlFor="companyName" required error={fieldErrors.companyName}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="companyName"
                autoComplete="organization"
                value={form.companyName}
                onChange={(e) => handleCompanyNameChange(e.target.value)}
                maxLength={120}
                invalid={!!fieldErrors.companyName}
              />
            )}
          </Field>

          <Field
            label="Endereço da empresa"
            htmlFor="slug"
            required
            hint="Vai aparecer como innochat.app/SEU-ENDEREÇO."
            error={fieldErrors.slug}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="slug"
                value={form.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                maxLength={60}
                invalid={!!fieldErrors.slug}
              />
            )}
          </Field>

          <Field label="Segmento (opcional)" htmlFor="segment" hint="Ex.: salão, barbearia, clínica.">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="segment"
                value={form.segment}
                onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
                maxLength={80}
              />
            )}
          </Field>

          <Field label="Seu nome" htmlFor="ownerName" required error={fieldErrors.ownerName}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                name="ownerName"
                autoComplete="name"
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                maxLength={120}
                invalid={!!fieldErrors.ownerName}
              />
            )}
          </Field>

          <Field label="E-mail" htmlFor="email" required error={fieldErrors.email}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
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
                <Input
                  {...fieldProps}
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
                <Input
                  {...fieldProps}
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

          <div>
            <label className="flex items-start gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={form.acceptedTerms}
                onChange={(e) => setForm((f) => ({ ...f, acceptedTerms: e.target.checked }))}
                aria-invalid={!!fieldErrors.acceptedTerms || undefined}
                aria-describedby={fieldErrors.acceptedTerms ? "acceptedTerms-error" : undefined}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <span>
                Li e aceito os{" "}
                <Link href="/termos" target="_blank" className="text-primary hover:underline">
                  Termos de uso
                </Link>{" "}
                e a{" "}
                <Link href="/privacidade" target="_blank" className="text-primary hover:underline">
                  Política de privacidade
                </Link>
                .
              </span>
            </label>
            {fieldErrors.acceptedTerms ? (
              <p id="acceptedTerms-error" role="alert" className="mt-1.5 text-xs text-danger">
                {fieldErrors.acceptedTerms}
              </p>
            ) : null}
          </div>

          <Button type="submit" isLoading={isPending} className="mt-1">
            Criar conta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
