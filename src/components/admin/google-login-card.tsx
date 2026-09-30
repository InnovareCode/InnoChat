"use client";

import { useState } from "react";
import { Check, CheckCircle2, Copy, ExternalLink, RefreshCw, Trash2, X, XCircle, Zap } from "lucide-react";
import { cn } from "@/components/lib/cn";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { GoogleLogo } from "@/components/public/google-button";
import {
  getGoogleAuthConfigAction,
  removeGoogleClientSecretAction,
  saveGoogleAuthConfigAction,
  testGoogleAuthConfigAction,
} from "@/modules/platform/actions";

export type GoogleAuthConfig = {
  enabled: boolean;
  clientId: string | null;
  clientSecretSaved: boolean;
  redirectUri: string | null;
  origin: string | null;
};

const CONSOLE_URL = "https://console.cloud.google.com/apis/credentials";

function CopyRow({ label, value, hint }: { label: string; value: string | null; hint: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-text">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-card border border-border bg-bg p-2.5">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs text-text">{value ?? "Ainda não detectada"}</code>
        <Button type="button" variant="ghost" size="icon" aria-label={`Copiar ${label}`} onClick={copy} disabled={!value}>
          {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
      <p className="mt-1 text-xs text-text-secondary">{hint}</p>
    </div>
  );
}

const STEPS = [
  "Abra o Google Cloud Console em APIs e serviços, Credenciais, e crie um projeto (ou use um existente).",
  "Configure a tela de consentimento OAuth como Externa, com o nome InnoChat e o seu e-mail de suporte.",
  "Em Criar credenciais, escolha ID do cliente OAuth e o tipo Aplicativo da Web.",
  "Cole a Origem autorizada em Origens JavaScript autorizadas e o URI de redirecionamento em URIs de redirecionamento autorizados.",
  "Copie o ID do cliente e a chave secreta que o Google mostrar e cole nos campos acima.",
];

export function GoogleLoginCard({ initial }: { initial: GoogleAuthConfig | null }) {
  const { notify } = useToast();
  const [config, setConfig] = useState<GoogleAuthConfig | null>(initial);
  const [clientIdDraft, setClientIdDraft] = useState<string | null>(null);
  const [secretDraft, setSecretDraft] = useState("");
  const [busy, setBusy] = useState<"save" | "toggle" | "remove" | "test" | "reload" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; detalhe: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** Recarrega do servidor — depois de qualquer mudança, a fonte da verdade é o que o servidor devolve. */
  async function reload(): Promise<boolean> {
    try {
      const result = await getGoogleAuthConfigAction();
      if (result.ok) {
        setConfig(result.data);
        setLoadError(null);
        return true;
      }
      setLoadError(result.error.message);
    } catch {
      setLoadError("Falha de conexão ao carregar a configuração do Google.");
    }
    return false;
  }

  async function run(kind: "save" | "toggle" | "remove", fn: () => Promise<{ ok: boolean; error?: { message: string } }>, successTitle: string, after?: () => void) {
    setBusy(kind);
    try {
      const result = await fn();
      if (!result.ok) {
        notify({ variant: "error", title: "Não foi possível concluir", description: result.error?.message });
        return;
      }
      after?.();
      await reload();
      notify({ variant: "success", title: successTitle });
    } catch {
      notify({ variant: "error", title: "Falha de conexão", description: "Tente de novo em instantes." });
    } finally {
      setBusy(null);
    }
  }

  if (!config) {
    return (
      <Card className="rounded-hero">
        <CardHeader>
          <CardTitle>Login com Google</CardTitle>
          <CardDescription>Permite entrar e cadastrar a empresa com a conta Google.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3">
          <Alert variant="danger" className="w-full">
            {loadError ?? "Não deu para carregar a configuração do login com Google."}
          </Alert>
          <Button
            icon={RefreshCw}
            type="button"
            variant="secondary"
            isLoading={busy === "reload"}
            onClick={async () => {
              setBusy("reload");
              await reload();
              setBusy(null);
            }}
          >
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    );
  }

  const clientIdValue = clientIdDraft ?? config.clientId ?? "";
  const canEnable = !!config.clientId && config.clientSecretSaved;
  const anyBusy = busy !== null;

  function save() {
    const clientId = clientIdValue.trim();
    const clientSecret = secretDraft.trim();
    const clientIdChanged = clientIdDraft !== null && clientId !== (config?.clientId ?? "");
    if (!clientIdChanged && !clientSecret) {
      notify({ variant: "info", title: "Nada para salvar", description: "Em branco mantém o que já está salvo." });
      return;
    }
    void run(
      "save",
      () =>
        saveGoogleAuthConfigAction({
          ...(clientIdChanged ? { clientId } : {}),
          ...(clientSecret ? { clientSecret } : {}),
        }),
      "Credenciais do Google salvas.",
      () => {
        setClientIdDraft(null);
        setSecretDraft("");
        setTest(null);
      },
    );
  }

  async function runTest() {
    setTest(null);
    setBusy("test");
    try {
      const result = await testGoogleAuthConfigAction();
      setTest(result.ok ? result.data : { ok: false, detalhe: result.error.message });
    } catch {
      setTest({ ok: false, detalhe: "Falha de conexão ao testar. Tente de novo." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="rounded-hero" data-testid="google-login-card">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-[16rem] flex-1 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card border border-border bg-white shadow-card"
          >
            <GoogleLogo className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <CardTitle>Login com Google</CardTitle>
            <CardDescription>Deixa o cliente entrar e criar a conta da empresa com a conta Google, sem senha.</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.enabled ? "success" : "neutral"}>{config.enabled ? "Ligado" : "Desligado"}</Badge>
          <Switch
            checked={config.enabled}
            onCheckedChange={(next) =>
              void run("toggle", () => saveGoogleAuthConfigAction({ enabled: next }), next ? "Login com Google ligado." : "Login com Google desligado.")
            }
            disabled={anyBusy || (!config.enabled && !canEnable)}
            aria-label="Login com Google"
            aria-describedby="google-enable-hint"
          />
        </div>
      </CardHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        aria-label="Credenciais do Google"
      >
        <CardContent className="flex flex-col gap-4">
          {!canEnable ? (
            <p id="google-enable-hint" className="text-sm text-text-secondary">
              Para ligar, salve o Client ID e o Client Secret primeiro.
            </p>
          ) : (
            <p id="google-enable-hint" className="sr-only">
              Liga ou desliga o botão Entrar com Google nas telas de login e cadastro.
            </p>
          )}

          <Field label="Client ID">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                autoComplete="off"
                spellCheck={false}
                value={clientIdValue}
                onChange={(e) => setClientIdDraft(e.target.value)}
                placeholder="123456789-abc.apps.googleusercontent.com"
              />
            )}
          </Field>

          <Field label="Client Secret">
            {(fieldProps) => (
              <div className="flex flex-col gap-2">
                <Input
                  {...fieldProps}
                  type="password"
                  autoComplete="off"
                  value={secretDraft}
                  onChange={(e) => setSecretDraft(e.target.value)}
                  placeholder={config.clientSecretSaved ? "•••••••• (credencial salva)" : "Não configurado"}
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Badge variant={config.clientSecretSaved ? "success" : "neutral"}>
                    {config.clientSecretSaved ? "Credencial salva" : "Não configurado"}
                  </Badge>
                  {config.clientSecretSaved ? (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(true)}
                      disabled={anyBusy}
                      className="min-h-11 rounded-card px-1 text-xs font-semibold text-danger underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
                    >
                      Remover credencial salva
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CopyRow
              label="URI de redirecionamento"
              value={config.redirectUri}
              hint="Cole em URIs de redirecionamento autorizados no Google."
            />
            <CopyRow label="Origem autorizada" value={config.origin} hint="Cole em Origens JavaScript autorizadas no Google." />
          </div>

          <div className="rounded-hero border border-border bg-bg p-4">
            <p className="font-display text-sm font-bold text-text">Como criar o OAuth Client no Google</p>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-text-secondary marker:font-semibold marker:text-primary">
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <a href={CONSOLE_URL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Abrir o Google Cloud Console
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </Button>
          </div>

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
          <Button icon={Check} type="submit" isLoading={busy === "save"} loadingText="Salvando…" disabled={anyBusy && busy !== "save"}>
            Salvar credenciais
          </Button>
          <Button
            icon={Zap}
            type="button"
            variant="secondary"
            onClick={runTest}
            isLoading={busy === "test"}
            loadingText="Testando…"
            disabled={anyBusy && busy !== "test"}
          >
            Testar configuração
          </Button>
        </CardFooter>
      </form>

      {/* Sempre montado: nunca dentro de condicional que a própria ação desmonta. */}
      <Dialog open={confirmRemove} onOpenChange={(open) => !open && busy === null && setConfirmRemove(false)}>
        <DialogContent>
          <DialogHeader icon={Trash2} tone="danger">
            <DialogTitle>Remover o Client Secret?</DialogTitle>
            <DialogDescription>
              A credencial salva será apagada do servidor e o login com Google deixa de funcionar até você cadastrar outra.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button icon={X} type="button" variant="secondary" onClick={() => setConfirmRemove(false)} disabled={busy !== null}>
              Cancelar
            </Button>
            <Button
              icon={Trash2}
              type="button"
              variant="danger"
              isLoading={busy === "remove"}
              onClick={() =>
                void run("remove", () => removeGoogleClientSecretAction(), "Credencial removida.", () => {
                  setConfirmRemove(false);
                  setTest(null);
                })
              }
            >
              Sim, remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
