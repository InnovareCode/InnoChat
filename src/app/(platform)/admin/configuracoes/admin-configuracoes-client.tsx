"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, Copy, KeyRound, Loader2, Power, PowerOff, RefreshCw, XCircle } from "lucide-react";
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
  activateBotWorkflowAction,
  deactivateBotWorkflowAction,
  regenerateInternalApiSecretAction,
  syncN8nAction,
  testEvolutionConnectionAction,
  testMercadoPagoConnectionAction,
  testN8nConnectionAction,
  testSmtpConnectionAction,
  updatePlatformSettingsAction,
} from "@/modules/platform/actions";
import type { N8nSyncSummary } from "@/modules/platform/n8n-sync";
import type { PlatformSettingsView } from "@/modules/platform/service";

type TestResult = { ok: boolean; detalhe: string } | null;

/** Botão "Testar conexão" com resultado inline — usa os valores AINDA NÃO SALVOS do formulário
 * (decisão do dono: testar antes de gravar), nunca lê o que já está no banco. */
function TestConnectionButton({ onTest }: { onTest: () => Promise<TestResult> }) {
  const [result, setResult] = useState<TestResult>(null);
  const [isPending, startTransition] = useTransition();

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await onTest();
      setResult(r);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={run} disabled={isPending} className="self-start">
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
        Testar conexão
      </Button>
      {result ? (
        <p role="status" className={`flex items-center gap-1.5 text-sm ${result.ok ? "text-success" : "text-danger"}`}>
          {result.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {result.detalhe}
        </p>
      ) : null}
    </div>
  );
}

function CopyField({ label, value, hint }: { label: string; value: string | null; hint?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div>
      <p className="text-sm font-medium text-text">{label}</p>
      <div className="mt-1 flex items-center gap-2 rounded-card border border-border bg-bg p-2.5">
        <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-text">
          {value ?? "Ainda não detectada"}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Copiar ${label}`}
          onClick={copy}
          disabled={!value}
        >
          {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </Button>
      </div>
      {hint ? <p className="mt-1 text-xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}

function ChecklistBadge({ label, ready }: { label: string; ready: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      {ready ? (
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
      ) : (
        <XCircle className="h-4 w-4 text-text-secondary" aria-hidden="true" />
      )}
      <span className={ready ? "text-text" : "text-text-secondary"}>{label}</span>
    </span>
  );
}

export function AdminConfiguracoesClient({ initialSettings }: { initialSettings: PlatformSettingsView }) {
  const { notify } = useToast();
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [evolutionApiUrl, setEvolutionApiUrl] = useState(settings.evolutionApiUrl ?? "");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");

  const [n8nBaseUrl, setN8nBaseUrl] = useState(settings.n8nBaseUrl ?? "");
  const [n8nApiKey, setN8nApiKey] = useState("");
  const [n8nWebhookBaseUrl, setN8nWebhookBaseUrl] = useState(settings.n8nWebhookBaseUrl ?? "");

  const [mercadoPagoAccessToken, setMercadoPagoAccessToken] = useState("");
  const [mercadoPagoWebhookSecret, setMercadoPagoWebhookSecret] = useState("");

  const [smtpHost, setSmtpHost] = useState(settings.smtpHost ?? "");
  const [smtpPort, setSmtpPort] = useState(settings.smtpPort ? String(settings.smtpPort) : "");
  const [smtpSecure, setSmtpSecure] = useState(!!settings.smtpSecure);
  const [smtpUser, setSmtpUser] = useState(settings.smtpUser ?? "");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState(settings.smtpFrom ?? "");

  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [syncSummary, setSyncSummary] = useState<N8nSyncSummary | null>(null);
  const [botActive, setBotActive] = useState<boolean | null>(null);
  const [confirmActivate, setConfirmActivate] = useState<"on" | "off" | null>(null);

  // Checklist do topo (pedido do dono): o que já está pronto para o bot funcionar.
  const evolutionReady = !!settings.evolutionApiUrl && !!settings.evolutionApiKeyMasked;
  const n8nReady = !!settings.n8nBaseUrl && !!settings.n8nApiKeyMasked;
  const smtpReady = !!settings.smtpHost;
  const mpReady = !!settings.mercadoPagoAccessTokenMasked;

  function handleSaveEvolution(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        evolutionApiUrl,
        evolutionApiKey: evolutionApiKey || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSettings(result.data);
      setEvolutionApiKey("");
      notify({ variant: "success", title: "Evolution API salva." });
    });
  }

  function handleSaveN8n(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        n8nBaseUrl,
        n8nApiKey: n8nApiKey || undefined,
        n8nWebhookBaseUrl,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSettings(result.data);
      setN8nApiKey("");
      notify({ variant: "success", title: "n8n salvo." });
    });
  }

  function handleSaveMercadoPago(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updatePlatformSettingsAction({
        mercadoPagoAccessToken: mercadoPagoAccessToken || undefined,
        mercadoPagoWebhookSecret: mercadoPagoWebhookSecret || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setSettings(result.data);
      setMercadoPagoAccessToken("");
      setMercadoPagoWebhookSecret("");
      notify({ variant: "success", title: "Mercado Pago salvo." });
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

  function handleSyncN8n() {
    setSyncSummary(null);
    startTransition(async () => {
      const result = await syncN8nAction();
      if (!result.ok) {
        notify({ variant: "error", title: "Não foi possível sincronizar o n8n", description: result.error.message });
        return;
      }
      setSyncSummary(result.data);
      setBotActive(null); // sync nunca ativa/desativa — status volta a "não verificado"
      notify({ variant: "success", title: "n8n sincronizado." });
    });
  }

  function handleToggleBot(activate: boolean) {
    startTransition(async () => {
      const result = activate ? await activateBotWorkflowAction() : await deactivateBotWorkflowAction();
      if (!result.ok) {
        notify({
          variant: "error",
          title: activate ? "Não foi possível ativar o bot" : "Não foi possível desativar o bot",
          description: result.error.message,
        });
        setConfirmActivate(null);
        return;
      }
      setBotActive(activate);
      notify({ variant: "success", title: activate ? "Bot ativado." : "Bot desativado." });
      setConfirmActivate(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações da plataforma"
        description="Evolution, n8n, e-mail transacional, Mercado Pago e o segredo da API interna — tudo cadastrado aqui, nunca em variável de ambiente."
      />

      {error ? <Alert variant="danger">{error}</Alert> : null}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <ChecklistBadge label="Evolution" ready={evolutionReady} />
          <ChecklistBadge label="n8n" ready={n8nReady} />
          <ChecklistBadge label="SMTP" ready={smtpReady} />
          <ChecklistBadge label="Mercado Pago" ready={mpReady} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>URLs detectadas</CardTitle>
          <CardDescription>Detectadas automaticamente pelo servidor — não são digitadas aqui.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CopyField
            label="URL pública do painel"
            value={settings.publicBaseUrl}
            hint={
              settings.publicBaseUrl
                ? "É o que o n8n usa para chamar a API interna do painel."
                : "Detectada sozinha na primeira vez que qualquer configuração abaixo for salva."
            }
          />
          <CopyField
            label="URL base de webhook do n8n"
            value={settings.n8nWebhookBaseUrl}
            hint="A Evolution chama esta URL seguida do token da instância (gerado ao conectar cada número, na tela de WhatsApp da empresa)."
          />
        </CardContent>
      </Card>

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
            <TestConnectionButton
              onTest={async () => {
                if (!evolutionApiUrl || !evolutionApiKey) {
                  return { ok: false, detalhe: "Informe URL e chave (mesmo que ainda não tenha salvo) para testar." };
                }
                const result = await testEvolutionConnectionAction({ evolutionApiUrl, evolutionApiKey });
                return result.ok ? result.data : { ok: false, detalhe: result.error.message };
              }}
            />
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
          <CardTitle>n8n</CardTitle>
          <CardDescription>Orquestra as conversas do bot no WhatsApp.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveN8n}>
          <CardContent className="flex flex-col gap-4">
            <Field label="URL do n8n" hint="Endereço base da instância do n8n (API pública).">
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="url"
                  value={n8nBaseUrl}
                  onChange={(e) => setN8nBaseUrl(e.target.value)}
                  placeholder="https://n8n.exemplo.com"
                />
              )}
            </Field>
            <Field
              label="Chave da API do n8n"
              hint={
                settings.n8nApiKeyMasked
                  ? `Chave atual: ${settings.n8nApiKeyMasked}. Deixe em branco para manter.`
                  : "Nenhuma chave configurada ainda. Gere em Settings → n8n API, dentro do n8n."
              }
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="password"
                  autoComplete="off"
                  value={n8nApiKey}
                  onChange={(e) => setN8nApiKey(e.target.value)}
                  placeholder="••••••••"
                />
              )}
            </Field>
            <Field label="URL base de webhook do n8n" hint="Para onde a Evolution manda os eventos de cada instância.">
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
            <TestConnectionButton
              onTest={async () => {
                if (!n8nBaseUrl || !n8nApiKey) {
                  return { ok: false, detalhe: "Informe URL e chave (mesmo que ainda não tenha salvo) para testar." };
                }
                const result = await testN8nConnectionAction({ n8nBaseUrl, n8nApiKey });
                return result.ok ? result.data : { ok: false, detalhe: result.error.message };
              }}
            />
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
          <CardTitle>Bot no n8n</CardTitle>
          <CardDescription>
            Sincroniza a URL do painel, a URL da Evolution e as credenciais no workflow do bot — nunca ativa
            sozinho.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Badge variant={botActive === null ? "neutral" : botActive ? "success" : "danger"}>
              {botActive === null ? "Status não verificado" : botActive ? "Bot ativo" : "Bot inativo"}
            </Badge>
          </div>
          {syncSummary ? (
            <Alert variant="success">
              Sincronizado: {syncSummary.credentialsRotated} credencial(is) rotacionada(s), {syncSummary.nodesRebound}{" "}
              nó(s) reconectado(s). Workflow do bot: <code className="text-xs">{syncSummary.botWorkflowId}</code>.
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleSyncN8n} isLoading={isPending}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Sincronizar n8n
          </Button>
          <Button type="button" variant="secondary" onClick={() => setConfirmActivate("on")} disabled={isPending}>
            <Power className="h-4 w-4" aria-hidden="true" />
            Ativar bot
          </Button>
          <Button type="button" variant="danger" onClick={() => setConfirmActivate("off")} disabled={isPending}>
            <PowerOff className="h-4 w-4" aria-hidden="true" />
            Desativar bot
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mercado Pago</CardTitle>
          <CardDescription>Usado para gerar o Pix das faturas e validar o webhook de pagamento.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSaveMercadoPago}>
          <CardContent className="flex flex-col gap-4">
            <Field
              label="Access token"
              hint={
                settings.mercadoPagoAccessTokenMasked
                  ? `Token atual: ${settings.mercadoPagoAccessTokenMasked}. Deixe em branco para manter.`
                  : "Nenhum token configurado ainda — sem ele, o Pix das faturas não é gerado."
              }
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="password"
                  autoComplete="off"
                  value={mercadoPagoAccessToken}
                  onChange={(e) => setMercadoPagoAccessToken(e.target.value)}
                  placeholder="••••••••"
                />
              )}
            </Field>
            <Field
              label="Segredo do webhook"
              hint={
                settings.mercadoPagoWebhookSecretMasked
                  ? `Segredo atual: ${settings.mercadoPagoWebhookSecretMasked}. Deixe em branco para manter.`
                  : "Nenhum segredo configurado ainda — sem ele, notificações de pagamento são rejeitadas."
              }
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="password"
                  autoComplete="off"
                  value={mercadoPagoWebhookSecret}
                  onChange={(e) => setMercadoPagoWebhookSecret(e.target.value)}
                  placeholder="••••••••"
                />
              )}
            </Field>
            <TestConnectionButton
              onTest={async () => {
                if (!mercadoPagoAccessToken) {
                  return { ok: false, detalhe: "Informe o access token (mesmo que ainda não tenha salvo) para testar." };
                }
                const result = await testMercadoPagoConnectionAction({ mercadoPagoAccessToken });
                return result.ok ? result.data : { ok: false, detalhe: result.error.message };
              }}
            />
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
            <TestConnectionButton
              onTest={async () => {
                if (!smtpHost || !smtpPort) {
                  return { ok: false, detalhe: "Informe servidor e porta (mesmo que ainda não tenha salvo) para testar." };
                }
                const result = await testSmtpConnectionAction({
                  smtpHost,
                  smtpPort: Number(smtpPort),
                  smtpSecure,
                  smtpUser: smtpUser || undefined,
                  smtpPassword: smtpPassword || undefined,
                });
                return result.ok ? result.data : { ok: false, detalhe: result.error.message };
              }}
            />
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
            imediatamente — sincronize o n8n de novo em seguida.
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

      <Dialog open={!!confirmActivate} onOpenChange={(open) => !open && setConfirmActivate(null)}>
        <DialogContent>
          <DialogTitle>{confirmActivate === "on" ? "Ativar o bot" : "Desativar o bot"}</DialogTitle>
          <DialogDescription>
            {confirmActivate === "on"
              ? "O workflow do bot passa a responder no WhatsApp de todas as empresas conectadas. Sincronize o n8n antes, se ainda não sincronizou."
              : "O workflow do bot deixa de responder no WhatsApp de todas as empresas conectadas."}
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmActivate(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant={confirmActivate === "off" ? "danger" : "primary"}
              onClick={() => handleToggleBot(confirmActivate === "on")}
              isLoading={isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
