import { cn } from "@/components/lib/cn";

export type WhatsappTopbarStatus = "connected" | "disconnected" | "none";

const STATUS_CONFIG: Record<WhatsappTopbarStatus, { label: string; dotClass: string; textClass: string; pulse: boolean }> = {
  connected: { label: "Bot ativo", dotClass: "bg-success", textClass: "text-success", pulse: true },
  disconnected: { label: "WhatsApp desconectado", dotClass: "bg-danger", textClass: "text-danger", pulse: false },
  none: { label: "Nenhum número", dotClass: "bg-text-secondary/60", textClass: "text-text-secondary", pulse: false },
};

/**
 * Indicador "ao vivo" com dado real (docs/design/premium-spec.md §1/§10) — a topbar SEMPRE
 * mostra o status de conexão do WhatsApp, nunca só decoração. O valor chega pronto do servidor
 * (`WhatsappTopbarStatus`, um dos 3 valores) — este componente só desenha, nunca decide.
 */
export function WhatsappStatusChip({ status }: { status: WhatsappTopbarStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2.5 py-1 text-xs font-medium"
      title={config.label}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {config.pulse ? (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", config.dotClass)} aria-hidden="true" />
        ) : null}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", config.dotClass)} aria-hidden="true" />
      </span>
      <span className={cn("hidden sm:inline", config.textClass)}>{config.label}</span>
    </span>
  );
}
