import { getPrisma } from "@/lib/db/prisma";
import type { InternalApiContext } from "./internal-auth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const STATE_TO_STATUS: Record<string, "CONNECTED" | "DISCONNECTED" | "QRCODE"> = {
  open: "CONNECTED",
  close: "DISCONNECTED",
  connecting: "QRCODE",
};

/**
 * `POST /connection-events` (docs/arquitetura.md §2 "Queda inesperada", §6.8): aplica o
 * `connection.update` da Evolution na instância já resolvida pelo token — **sempre** devolve
 * `200`, mesmo para um payload que não reconhecemos (o adaptador de chamadas para a Evolution é
 * escopo da Fase 3, ainda não implementado — ver PENDÊNCIAS do handoff; este endpoint só
 * consome o webhook, não faz chamadas de volta para a Evolution).
 */
export async function applyConnectionEvent(ctx: InternalApiContext, payload: unknown): Promise<{ applied: boolean }> {
  if (!isRecord(payload)) return { applied: false };
  const data = payload.data;
  const state = isRecord(data) && typeof data.state === "string" ? data.state : null;
  const status = state ? STATE_TO_STATUS[state] : undefined;
  if (!status) return { applied: false };

  await getPrisma().whatsappInstance.update({
    where: { id: ctx.instance.id },
    data: {
      status,
      ...(status === "CONNECTED" ? { lastConnectedAt: new Date() } : {}),
    },
  });
  return { applied: true };
}
