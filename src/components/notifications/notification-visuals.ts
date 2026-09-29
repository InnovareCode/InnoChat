import {
  BadgeCheck,
  BellRing,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CheckCircle2,
  Hourglass,
  LayoutDashboard,
  MessageCircle,
  Settings2,
  UserX,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { NotificationKind, NotificationSeverity, NotificationSource } from "./types";

/** Ícone por tipo de notificação. */
export const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  APPOINTMENT_CREATED: CalendarPlus,
  APPOINTMENT_RESCHEDULED: CalendarClock,
  APPOINTMENT_CANCELED: CalendarX,
  APPOINTMENT_COMPLETED: CheckCircle2,
  APPOINTMENT_NO_SHOW: UserX,
  APPOINTMENT_UPCOMING: BellRing,
  WHATSAPP_DISCONNECTED: WifiOff,
  TRIAL_ENDING: Hourglass,
  PAYMENT_CONFIRMED: BadgeCheck,
};

/** Cor do "chip" do ícone por severidade — só tokens, valem nos 3 temas. */
export const SEVERITY_TONE: Record<NotificationSeverity, string> = {
  info: "bg-primary/10 text-primary",
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
};

export const SOURCE_VISUAL: Record<NotificationSource, { icon: LucideIcon; label: string }> = {
  WHATSAPP: { icon: MessageCircle, label: "WhatsApp" },
  PANEL: { icon: LayoutDashboard, label: "Painel" },
  SYSTEM: { icon: Settings2, label: "Sistema" },
};
