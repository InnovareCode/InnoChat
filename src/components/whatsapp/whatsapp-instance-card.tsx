"use client";

import { RefreshCw, Unlink, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/cn";
import { formatDateTimeLabel } from "@/components/lib/format-date";
import { formatPhoneDisplay } from "@/components/lib/format-phone";
import type { WhatsappInstanceView } from "@/modules/whatsapp/actions";

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
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", config.dotClass)} />
      ) : null}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", config.dotClass)} />
    </span>
  );
}

/**
 * Um card por número (mission: "Lista de números"). Ações de escrita (atualizar/desconectar/
 * remover) só aparecem quando `isOwner` — quem só visualiza (STAFF) vê a mesma informação sem
 * nenhum botão de mutação.
 */
export function WhatsappInstanceCard({
  instance,
  timezone,
  isOwner,
  writeBlocked,
  writeBlockedHint,
  isRefreshing,
  onRefresh,
  onDisconnect,
  onRemove,
}: {
  instance: WhatsappInstanceView;
  timezone: string;
  isOwner: boolean;
  writeBlocked: boolean;
  writeBlockedHint: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 rounded-hero p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-bold text-text">{instance.label}</p>
          <p className="mt-0.5 text-sm text-text-secondary">
            {instance.phoneE164 ? formatPhoneDisplay(instance.phoneE164) : "Número ainda não identificado"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_BADGE[instance.status]}>
            <StatusDot status={instance.status} />
            {STATUS_LABEL[instance.status]}
          </Badge>
          {instance.sandbox ? <Badge variant="neutral">Teste (sandbox)</Badge> : null}
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        {instance.lastConnectedAt
          ? `Conectado em ${formatDateTimeLabel(instance.lastConnectedAt, timezone)}`
          : `Criado em ${formatDateTimeLabel(instance.createdAt, timezone)}`}
      </p>

      {isOwner ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            isLoading={isRefreshing}
            disabled={writeBlocked}
            title={writeBlocked ? writeBlockedHint : undefined}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Atualizar status
          </Button>
          {instance.status !== "DISCONNECTED" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onDisconnect}
              disabled={writeBlocked}
              title={writeBlocked ? writeBlockedHint : undefined}
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
              Desconectar
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            disabled={writeBlocked}
            title={writeBlocked ? writeBlockedHint : undefined}
            className="text-danger hover:bg-danger-bg"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remover
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
