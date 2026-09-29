import { LayoutDashboard, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/lib/cn";

export type AppointmentStatus = "SCHEDULED" | "CANCELED" | "COMPLETED" | "NO_SHOW";
export type AppointmentSource = "WHATSAPP" | "PANEL";

/**
 * Fonte única de rótulo e cor do status do agendamento — lista, agenda, detalhe e ficha do
 * cliente leem daqui, para "Faltou" nunca voltar a ser "Não veio" em uma tela e "Faltou" em outra.
 */
export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

export const APPOINTMENT_STATUS_VARIANT: Record<AppointmentStatus, "primary" | "success" | "danger" | "warning"> = {
  SCHEDULED: "primary",
  COMPLETED: "success",
  CANCELED: "danger",
  NO_SHOW: "warning",
};

export function AppointmentStatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  return (
    <Badge variant={APPOINTMENT_STATUS_VARIANT[status]} className={className}>
      {APPOINTMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

const SOURCE_CONFIG: Record<AppointmentSource, { label: string; icon: typeof MessageCircle }> = {
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle },
  PANEL: { label: "Painel", icon: LayoutDashboard },
};

/** Selo discreto de origem: ícone + texto pequeno, sem cor de status (não compete com o badge). */
export function AppointmentSourceBadge({
  source,
  className,
  iconOnly = false,
}: {
  source: AppointmentSource | null | undefined;
  className?: string;
  /** Só o ícone (com `title`/`aria-label`) para espaços apertados. */
  iconOnly?: boolean;
}) {
  if (!source) return null;
  const { label, icon: Icon } = SOURCE_CONFIG[source];
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs text-text-secondary", className)}
      title={iconOnly ? `Origem: ${label}` : undefined}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {iconOnly ? <span className="sr-only">Origem: {label}</span> : label}
    </span>
  );
}
