"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/components/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
  ConnectionTest,
  MercadoPagoEnvCredentials,
  MercadoPagoSecretField,
} from "./mercado-pago-types";

export type CredentialsDraft = { publicKey?: string; accessToken: string; webhookSecret: string };

function SecretInput({
  label,
  saved,
  value,
  onChange,
  onRemove,
  disabled,
}: {
  label: string;
  saved: boolean;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <Field label={label}>
      {(fieldProps) => (
        <div className="flex flex-col gap-2">
          <Input
            {...fieldProps}
            type="password"
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={saved ? "•••••••• (credencial salva)" : "Não configurado"}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Badge variant={saved ? "success" : "neutral"}>{saved ? "Credencial salva" : "Não configurado"}</Badge>
            {saved ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="min-h-11 rounded-card px-1 text-xs font-semibold text-danger underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
              >
                Remover credencial salva
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Field>
  );
}

/** Um dos dois cards de credenciais (produção / sandbox). Controlado: o estado mora no painel. */
export function MercadoPagoCredentialsCard({
  title,
  description,
  active,
  saved,
  draft,
  labelSuffix,
  publicKeyPlaceholder,
  busy,
  onDraftChange,
  onSave,
  onTest,
  onRemoveSecret,
}: {
  title: string;
  description: string;
  active: boolean;
  saved: MercadoPagoEnvCredentials;
  draft: CredentialsDraft;
  /** "" em produção, " de teste" no sandbox. */
  labelSuffix: string;
  publicKeyPlaceholder: string;
  busy: boolean;
  onDraftChange: (patch: Partial<CredentialsDraft>) => void;
  onSave: () => void;
  onTest: () => Promise<ConnectionTest>;
  onRemoveSecret: (field: MercadoPagoSecretField) => void;
}) {
  const [test, setTest] = useState<ConnectionTest | null>(null);
  const [testing, setTesting] = useState(false);

  async function runTest() {
    setTest(null);
    setTesting(true);
    try {
      setTest(await onTest());
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className={cn("rounded-hero", !active && "bg-bg shadow-none")} data-active={active}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CardTitle className={cn(!active && "text-text-secondary")}>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge variant={active ? "primary" : "neutral"}>{active ? "Ativo" : "Secundário"}</Badge>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        aria-label={title}
      >
        <CardContent className="flex flex-col gap-4">
          <Field label={`Public Key${labelSuffix}`}>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                autoComplete="off"
                value={draft.publicKey ?? saved.publicKey ?? ""}
                onChange={(e) => onDraftChange({ publicKey: e.target.value })}
                placeholder={publicKeyPlaceholder}
              />
            )}
          </Field>
          <SecretInput
            label={`Access Token${labelSuffix}`}
            saved={saved.accessTokenSaved}
            value={draft.accessToken}
            onChange={(v) => onDraftChange({ accessToken: v })}
            onRemove={() => onRemoveSecret("accessToken")}
            disabled={busy}
          />
          <SecretInput
            label={`Webhook Secret${labelSuffix}`}
            saved={saved.webhookSecretSaved}
            value={draft.webhookSecret}
            onChange={(v) => onDraftChange({ webhookSecret: v })}
            onRemove={() => onRemoveSecret("webhookSecret")}
            disabled={busy}
          />
          {test ? (
            <p role="status" className={cn("flex items-start gap-1.5 text-sm", test.ok ? "text-success" : "text-danger")}>
              {test.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              {test.detalhe}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex-wrap">
          <Button type="submit" isLoading={busy} loadingText="Salvando…">
            Salvar credenciais
          </Button>
          <Button type="button" variant="secondary" onClick={runTest} isLoading={testing} loadingText="Testando…" disabled={busy}>
            Testar conexão
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
