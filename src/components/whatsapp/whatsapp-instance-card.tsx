"use client";

import { RefreshCw, Unlink, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-base font-bold text-text">{instance.label}</p>
          <p className="mt-0.5 text-sm text-text-secondary">
            {instance.phoneE164 ? formatPhoneDisplay(instance.phoneE164) : "Número ainda não identificado"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_BADGE[instance.status]}>{STATUS_LABEL[instance.status]}</Badge>
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
