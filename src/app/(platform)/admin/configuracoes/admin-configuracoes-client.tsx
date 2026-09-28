"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import {
  regenerateInternalApiSecretAction,
  updatePlatformSettingsAction,
} from "@/modules/platform/actions";
import type { PlatformSettingsView } from "@/modules/platform/service";

export function AdminConfiguracoesClient({ initialSettings }: { initialSettings: PlatformSettingsView }) {
  const { notify } = useToast();
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [evolutionApiUrl, setEvolutionApiUrl] = useState(settings.evolutionApiUrl ?? "");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [n8nWebhookBaseUrl, setN8nWebhookBaseUrl] = useState(settings.n8nWebhookBaseUrl ?? "");

  const [smtpHost, setSmtpHost] = useState(settings.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState(settings.smtpPort ? String(settings.smtpPort) : "");
  const [smtpSecure, setSmtpSecure] = useState(!!settings.smtpSecure);
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState(settings.smtpFrom ?? "");

  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSaveEvolution(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        evolutionApiUrl,
        evolutionApiKey: evolutionApiKey || undefined,
        n8nWebhookBaseUrl,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSettings(result.data);
      setEvolutionApiKey("");
      notify({ variant: "success", title: "Configurações salvas." });
    });
  }

  function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        smtpHost,
        smtpPort: smtpPort ? Number(smtpPort) : undefined,
        smtpSecure,
        smtpUser,
        smtpPassword: smtpPassword || undefined,
        smtpFrom,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSettings(result.data);
      setSmtpPassword("");
      notify({ variant: "success", title: "SMTP salvo." });
    });
  }

  function handleRegenerateSecret() {
    startTransition(async () => {
      const result = await regenerateInternalApiSecretAction();
      if (!result.ok) {
        notify({ variant: "error", title: "Não foi possível gerar o segredo", description: result.error.message });
        return;
      }
      setNewSecret(result.data.secret);
      setCopied(false);
      setSecretDialogOpen(true);
      setSettings((prev) => ({ ...prev, internalApiSecretConfigured: true }));
    });
  }

  async function copySecret() {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações da plataforma"
        description="Evolution, e-mail transacional e segredo da API interna do n8n."
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>Evolution API</CardTitle>
          <CardDescription>Usada para conectar os números de WhatsApp das empresas.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveEvolution}>
          <CardContent className="flex flex-col gap-4">
            <Field label="URL da Evolution" hint="Endereço base da instância da Evolution API.">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="url"
                  value={evolutionApiUrl}
                  onChange={(e) => setEvolutionApiUrl(e.target.value)}
                  placeholder="https://evolution.exemplo.com"
                />
              )}
            </Field>
            <Field
              label="Chave da Evolution"
              hint={
                settings.evolutionApiKeyMasked
                  ? `Chave atual: ${settings.evolutionApiKeyMasked}. Deixe em branco para manter.`
                  : "Nenhuma chave configurada ainda."
              }
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="password"
                  autoComplete="off"
                  value={evolutionApiKey}
                  onChange={(e) => setEvolutionApiKey(e.target.value)}
                  placeholder="••••••••"
                />
              )}
            </Field>
            <Field label="URL base de webhook do n8n" hint="Para onde a Evolution e o painel mandam eventos.">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="url"
                  value={n8nWebhookBaseUrl}
                  onChange={(e) => setN8nWebhookBaseUrl(e.target.value)}
                  placeholder="https://n8n.exemplo.com/webhook"
                />
              )}
            </Field>
          </CardContent>
          <CardFooter>
            <Button type="submit" isLoading={isPending}>
              Salvar
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>E-mail transacional (SMTP)</CardTitle>
          <CardDescription>Usado para lembretes e notificações por e-mail.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveSmtp}>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Servidor SMTP">
                {(fieldProps) => (
                  <Input {...fieldProps} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.exemplo.com" />
                )}
              </Field>
              <Field label="Porta">
                {(fieldProps) => (
                  <Input {...fieldProps} type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
                )}
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={smtpSecure}
                onChange={(e) => setSmtpSecure(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Conexão segura (TLS/SSL)
            </label>
            <Field label="Usuário SMTP">
              {(fieldProps) => <Input {...fieldProps} value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />}
            </Field>
            <Field
              label="Senha SMTP"
              hint={
                settings.smtpPasswordMasked
                  ? `Senha atual: ${settings.smtpPasswordMasked}. Deixe em branco para manter.`
                  : "Nenhuma senha configurada ainda."
              }
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="password"
                  autoComplete="off"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••"
                />
              )}
            </Field>
            <Field label="E-mail de remetente" hint="Aparece como remetente nos e-mails enviados.">
              {(fieldProps) => (
                <Input {...fieldProps} type="email" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="contato@exemplo.com" />
              )}
            </Field>
          </CardContent>
          <CardFooter>
            <Button type="submit" isLoading={isPending}>
              Salvar
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Segredo da API interna (n8n → painel)</CardTitle>
          <CardDescription>
            Usado pelo n8n para autenticar chamadas ao painel. Gerar um novo segredo invalida o anterior
            imediatamente — atualize a automação do n8n em seguida.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={settings.internalApiSecretConfigured ? "success" : "neutral"}>
              {settings.internalApiSecretConfigured ? "Configurado" : "Não configurado"}
            </Badge>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="secondary" onClick={handleRegenerateSecret} isLoading={isPending}>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {settings.internalApiSecretConfigured ? "Gerar novo segredo" : "Gerar segredo"}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
        <DialogContent>
          <DialogTitle>Segredo gerado</DialogTitle>
          <DialogDescription>
            Copie agora — por segurança, ele não pode ser mostrado de novo depois que você fechar esta janela.
          </DialogDescription>
          <div className="mt-4 flex items-center gap-2 rounded-card border border-border bg-bg p-3">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-sm text-text">{newSecret}</code>
            <Button type="button" variant="ghost" size="icon" aria-label="Copiar segredo" onClick={copySecret}>
              {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setSecretDialogOpen(false)}>
              Já copiei, fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
