"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, Copy } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTimeLabel } from "@/components/lib/format-date";

export type BillingStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";

export type BillingSnapshot = {
  planName: string;
  priceCents: number;
  status: BillingStatus;
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  timezone: string;
  invoice: {
    amountCents: number;
    dueAt: string;
    pixCopyPaste: string | null;
    pixExpiresAt: string | null;
    paidAt: string | null;
  } | null;
};

const STATUS_LABEL: Record<BillingStatus, string> = {
  TRIALING: "Em teste",
  ACTIVE: "Ativa",
  PAST_DUE: "Fatura atrasada",
  SUSPENDED: "Suspensa",
  CANCELED: "Cancelada",
};

const STATUS_BADGE: Record<BillingStatus, "primary" | "success" | "warning" | "danger"> = {
  TRIALING: "primary",
  ACTIVE: "success",
  PAST_DUE: "warning",
  SUSPENDED: "danger",
  CANCELED: "danger",
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "Atualização periódica do status até pagar": `router.refresh()` re-roda o Server Component
 * (`page.tsx`), que relê o banco — sem precisar de uma Server Action nova só para polling. Para
 * de repetir quando a fatura já não está mais em aberto (nada a esperar). */
function useStatusPolling(shouldPoll: boolean, intervalMs = 15_000) {
  const router = useRouter();
  useEffect(() => {
    if (!shouldPoll) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [shouldPoll, intervalMs, router]);
}

function PixCard({ invoice, timezone }: { invoice: NonNullable<BillingSnapshot["invoice"]>; timezone: string }) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const canvasRequestId = useRef(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!invoice.pixCopyPaste) {
        setQrDataUrl(null);
        return;
      }
      const requestId = ++canvasRequestId.current;
      QRCode.toDataURL(invoice.pixCopyPaste, { width: 240, margin: 1 })
        .then((url) => {
          if (canvasRequestId.current === requestId) setQrDataUrl(url);
        })
        .catch(() => {
          if (canvasRequestId.current === requestId) setQrDataUrl(null);
        });
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [invoice.pixCopyPaste]);

  async function copyCode() {
    if (!invoice.pixCopyPaste) return;
    await navigator.clipboard.writeText(invoice.pixCopyPaste);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fatura em aberto</CardTitle>
        <CardDescription>
          {formatBRL(invoice.amountCents)} — vencimento em {formatDateTimeLabel(invoice.dueAt, timezone)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {invoice.pixCopyPaste ? (
          <>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem gerada em runtime (data URL), não é asset estático
              <img
                src={qrDataUrl}
                alt="QR code Pix para pagamento da fatura"
                width={180}
                height={180}
                className="shrink-0 rounded-card border border-border"
              />
            ) : (
              <div className="flex h-[180px] w-[180px] shrink-0 items-center justify-center rounded-card border border-dashed border-border text-xs text-text-secondary">
                Gerando QR…
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-text">Pague pelo app do seu banco</p>
              <p className="mt-1 text-sm text-text-secondary">
                Escaneie o QR code ou copie o código Pix abaixo e cole na opção &ldquo;Pix Copia e Cola&rdquo;.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-card border border-border bg-bg p-3">
                <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs text-text">{invoice.pixCopyPaste}</code>
                <Button type="button" variant="ghost" size="icon" aria-label="Copiar código Pix" onClick={copyCode}>
                  {copied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
              {copied ? <p className="mt-1.5 text-xs text-success">Código copiado.</p> : null}
              {invoice.pixExpiresAt ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Este Pix vale até {formatDateTimeLabel(invoice.pixExpiresAt, timezone)}. Depois disso um novo é gerado
                  automaticamente.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <Alert variant="info">
            O Pix desta fatura ainda está sendo gerado. Atualizamos esta tela automaticamente — se demorar, volte em
            alguns minutos.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

export function AssinaturaClient({ snapshot }: { snapshot: BillingSnapshot }) {
  const stillWaitingPayment = snapshot.invoice !== null && !snapshot.invoice.paidAt;
  useStatusPolling(stillWaitingPayment);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Assinatura" description="Plano atual, status e fatura em aberto." />

      <Card>
        <CardHeader>
          <CardTitle>{snapshot.planName}</CardTitle>
          <CardDescription>
            {snapshot.priceCents > 0
              ? `${formatBRL(snapshot.priceCents)} por mês`
              : "Preço a definir — o teste continua funcionando normalmente."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge variant={STATUS_BADGE[snapshot.status]}>{STATUS_LABEL[snapshot.status]}</Badge>
          {snapshot.status === "TRIALING" && snapshot.trialEndsAt ? (
            <span className="text-sm text-text-secondary">
              Teste termina em {formatDateTimeLabel(snapshot.trialEndsAt, snapshot.timezone)}.
            </span>
          ) : null}
          {snapshot.status === "ACTIVE" ? (
            <span className="text-sm text-text-secondary">
              Próxima cobrança em {formatDateTimeLabel(snapshot.currentPeriodEnd, snapshot.timezone)}.
            </span>
          ) : null}
        </CardContent>
        {snapshot.status === "SUSPENDED" ? (
          <CardFooter>
            <Alert variant="danger" className="w-full">
              O painel está somente leitura e o bot não responde no WhatsApp enquanto a fatura estiver em aberto. Pague
              o Pix abaixo para reativar automaticamente.
            </Alert>
          </CardFooter>
        ) : null}
        {snapshot.status === "PAST_DUE" ? (
          <CardFooter>
            <Alert variant="warning" className="w-full">
              A fatura está atrasada. Pague o Pix abaixo antes do fim da carência para evitar a suspensão.
            </Alert>
          </CardFooter>
        ) : null}
      </Card>

      {snapshot.invoice ? <PixCard invoice={snapshot.invoice} timezone={snapshot.timezone} /> : null}
    </div>
  );
}
