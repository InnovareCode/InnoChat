"use server";

import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { runAction, type Result } from "@/lib/result";
import { listPlatformNotifications, markPlatformNotificationsRead, pollPlatformNotifications } from "./service";
import type { AdminNotification } from "./types";

/**
 * Central de notificações do admin da plataforma. Todas exigem `requirePlatformAdmin` (relê
 * `isPlatformAdmin` do banco): não-admin recebe FORBIDDEN, sem sessão UNAUTHORIZED. Desenho e
 * decisões em `service.ts` e docs/contratos.md.
 */

export async function listPlatformNotificationsAction(
  input: { cursor?: string } = {},
): Promise<Result<{ items: AdminNotification[]; unreadCount: number; nextCursor: string | null }>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const data = z.object({ cursor: z.string().max(200).optional() }).parse(input ?? {});
    return listPlatformNotifications(admin.id, data.cursor);
  });
}

export async function pollPlatformNotificationsAction(input: {
  since: string;
}): Promise<Result<{ unreadCount: number; fresh: AdminNotification[] }>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const data = z.object({ since: z.coerce.date() }).parse(input);
    return pollPlatformNotifications(admin.id, data.since);
  });
}

export async function markPlatformNotificationsReadAction(input: {
  ids?: string[];
  all?: boolean;
}): Promise<Result<{ unreadCount: number }>> {
  return runAction(async () => {
    const admin = await requirePlatformAdmin();
    const data = z
      .object({ ids: z.array(z.string().min(1).max(120)).max(100).optional(), all: z.boolean().optional() })
      .parse(input);
    return markPlatformNotificationsRead(admin.id, { ids: data.ids, all: data.all });
  });
}
