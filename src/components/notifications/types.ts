/**
 * Tipos do contrato de notificações — fonte única em `src/modules/notifications/types.ts` (Vega).
 * Só reexportados aqui para a UI importar de um lugar (import de tipo: some no build, não
 * puxa código de servidor para o client).
 */
import type { AppNotification } from "@/modules/notifications/types";

export type {
  AppNotification,
  NotificationKind,
  NotificationSeverity,
  TimelineItem,
  UpcomingAppointmentItem,
} from "@/modules/notifications/types";

export type NotificationSource = AppNotification["source"];
