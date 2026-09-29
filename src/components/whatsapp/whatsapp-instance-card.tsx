"use client";

import { useState } from "react";
import { RefreshCw, Unlink, Trash2, QrCode } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/cn";
import { formatDateTimeLabel } from "@/components/lib/format-date";
import { formatPhoneDisplay } from "@/components/lib/format-phone";
import type { QrCodeView, WhatsappInstanceView } from "@/modules/whatsapp/actions";
import { ChatScreen, OffScreen, PhoneFrame, PhoneScale, QrScreen, type WelcomePreview } from "./phone-mockup";
import { useInstanceQr } from "./use-instance-qr";

const STATUS_LABEL: Record<WhatsappInstanceView["status"], string> = {
  CONNECTED: "Conectado",
  QRCODE: "Aguardando QR",
  DISCONNECTED: "Desconectado",
};

const STATUS_BADGE: Record<WhatsappInstanceView["status"], "success" | "warning" | "danger"> = {
  CONNECTED: "success",
  QRCODE: "warning",
  DISCONNECTED: "danger",
};

/** Ponto pulsante por status — mesma leitura visual do chip "ao vivo" da topbar
 * (`whatsapp-status-chip.tsx`): só pulsa quando `CONNECTED`, coerente com "ao vivo" de verdade. */
const STATUS_DOT: Record<WhatsappInstanceView["status"], { dotClass: string; pulse: boolean }> = {
  CONNECTED: { dotClass: "bg-success", pulse: true },
  QRCODE: { dotClass: "bg-warning", pulse: false },
  DISCONNECTED: { dotClass: "bg-danger", pulse: false },
};

function StatusDot({ status }: { status: WhatsappInstanceView["status"] }) {
  const config = STATUS_DOT[status];
  return (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
      {config.pulse ? (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none",
            config.dotClass,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", config.dotClass)} />
    </span>
  );
}

/** Botão de ação dentro da tela do celular (fundo verde do WhatsApp, alvo de 44px). */
function ScreenButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      // h-[52px] no mobile: o celular fica em escala 0.85 (`PhoneScale`), 52 x 0.85 = 44px reais.
      className="inline-flex h-[52px] items-center sm:h-11 justify-center gap-1.5 rounded-full bg-[var(--wa-header)] px-5 text-[13px] font-semibold text-white transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      {children}
    </button>
  );
}

/**
 * Um card por número: celular estilizado (tela conforme o status) + painel de informações e
 * ações. Ações de escrita (atualizar/desconectar/remover) só aparecem quando `isOwner` — quem só
 * visualiza (STAFF) vê a mesma informação sem nenhum botão de mutação.
 *
 * O `Card` (classe `rounded-card`) precisa continuar sendo o ancestral comum do rótulo e dos
 * botões: o E2E (`tests/e2e/whatsapp.spec.ts`) localiza o card por
 * `ancestor::div[contains(@class,'rounded-card')]`. Por isso nada do mockup usa essa classe.
 */
export function WhatsappInstanceCard({
  tenantSlug,
  instance,
  timezone,
  isOwner,
  writeBlocked,
  writeBlockedHint,
  isRefreshing,
  onRefresh,
  onDisconnect,
  onRemove,
  onStatusChange,
  welcomePreview = null,
}: {
  tenantSlug: string;
  instance: WhatsappInstanceView;
  timezone: string;
  isOwner: boolean;
  writeBlocked: boolean;
  writeBlockedHint: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
  /** QR ao vivo detectou mudança (conectou / virou "aguardando QR"): o pai atualiza a lista. */
  onStatusChange: (next: WhatsappInstanceView) => void;
  /** Saudação e menu reais da empresa para a conversa ilustrativa do celular. */
  welcomePreview?: WelcomePreview | null;
}) {
  // "Reconectar" a partir da tela apagada: reaproveita o mesmo fluxo de QR ao vivo, sem criar
  // outra instância (uma desconectada continua ocupando a vaga do plano).
  const [reconnecting, setReconnecting] = useState(false);
  const status = instance.status;
  const qrActive = status === "QRCODE" || (reconnecting && status === "DISCONNECTED");

  function handleQrResult(result: QrCodeView) {
    if (result.status === instance.status && result.phoneE164 === instance.phoneE164) return;
    setReconnecting(false);
    onStatusChange({
      ...instance,
      status: result.status,
      phoneE164: result.phoneE164,
      lastConnectedAt: result.status === "CONNECTED" ? new Date().toISOString() : instance.lastConnectedAt,
    });
  }

  const qr = useInstanceQr({
    tenantSlug,
    instanceId: instance.id,
    active: qrActive,
    onResult: handleQrResult,
  });

  const phoneDisplay = instance.phoneE164 ? formatPhoneDisplay(instance.phoneE164) : null;
  const blockedTitle = writeBlocked ? writeBlockedHint : undefined;

  let screen: React.ReactNode;
  let altText = "";
  if (status === "CONNECTED") {
    screen = <ChatScreen label={instance.label} phoneDisplay={phoneDisplay} preview={welcomePreview} />;
    altText = `Ilustração de um celular com a conversa de exemplo do bot no número ${instance.label}.`;
  } else if (qrActive) {
    const message =
      qr.phase === "blocked"
        ? "Este número já usou o teste grátis."
        : qr.phase === "expired"
          ? "O QR code expirou."
          : qr.phase === "error"
            ? "Não deu para atualizar o QR agora."
            : qr.qrDataUrl
              ? "Escaneie para conectar"
              : "Gerando o QR code…";
    screen = (
      <QrScreen
        label={instance.label}
        qrDataUrl={qr.phase === "expired" || qr.phase === "blocked" ? null : qr.qrDataUrl}
        message={message}
        action={
          isOwner && (qr.phase === "expired" || qr.phase === "error") ? (
            <ScreenButton onClick={qr.refresh} disabled={writeBlocked} title={blockedTitle}>
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Atualizar QR
            </ScreenButton>
          ) : undefined
        }
      />
    );
  } else {
    screen = (
      <OffScreen
        message={
          isOwner ? "O bot está pausado. Reconecte com um QR code novo." : "O bot está pausado até o dono reconectar."
        }
        action={
          isOwner ? (
            <ScreenButton onClick={() => setReconnecting(true)} disabled={writeBlocked} title={blockedTitle}>
              <QrCode className="h-4 w-4" aria-hidden="true" />
              Reconectar
            </ScreenButton>
          ) : undefined
        }
      />
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden rounded-hero transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex justify-center bg-[radial-gradient(90%_70%_at_50%_0%,color-mix(in_oklab,var(--color-primary)_14%,transparent),transparent_75%)] px-4 pb-5 pt-6 sm:pt-7">
        <PhoneScale>
          <PhoneFrame>{screen}</PhoneFrame>
        </PhoneScale>
        {altText ? <p className="sr-only">{altText}</p> : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-words font-display text-base font-bold text-text">{instance.label}</p>
            <p className="mt-0.5 text-sm text-text-secondary">{phoneDisplay ?? "Número ainda não identificado"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={STATUS_BADGE[status]}>
              <StatusDot status={status} />
              {STATUS_LABEL[status]}
            </Badge>
            {instance.sandbox ? <Badge variant="neutral">Teste (sandbox)</Badge> : null}
          </div>
        </div>

        <p className="text-xs text-text-secondary">
          {instance.lastConnectedAt
            ? `Conectado desde ${formatDateTimeLabel(instance.lastConnectedAt, timezone)}`
            : `Criado em ${formatDateTimeLabel(instance.createdAt, timezone)}`}
        </p>

        {isOwner ? (
          <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
            <Button
              variant="secondary"
              size="sm"
              className="min-w-0 flex-1 gap-1.5 px-2"
              onClick={onRefresh}
              isLoading={isRefreshing}
              disabled={writeBlocked}
              title={blockedTitle}
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Atualizar status
            </Button>
            {status !== "DISCONNECTED" ? (
              <Button
                variant="secondary"
                size="sm"
                className="min-w-0 flex-1 gap-1.5 px-2"
                onClick={onDisconnect}
                disabled={writeBlocked}
                title={blockedTitle}
              >
                <Unlink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Desconectar
              </Button>
            ) : null}
            {/* Só ícone (44x44) para caber na mesma linha; o nome acessível continua "Remover". */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              disabled={writeBlocked}
              title={writeBlocked ? writeBlockedHint : "Remover"}
              aria-label="Remover"
              className="ml-auto shrink-0 text-danger hover:bg-danger-bg"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
