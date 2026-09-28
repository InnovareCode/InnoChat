import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { verifyInternalApiSecret } from "@/modules/platform/service";
import { runMaintenanceTick } from "@/modules/maintenance/tick";

/**
 * `POST /api/internal/v1/maintenance/tick` (docs/contratos.md — "Segurança"). MESMA autenticação
 * do `billing/tick` (`Authorization: Bearer <INTERNAL_API_SECRET>`, docs/arquitetura.md §6.1),
 * SEM `X-InnoChat-Instance` — não é escopado a uma instância, varre todos os tenants. Chamado
 * pelo `innochat-cron` (fora deste repo), periodicamente (ex.: 1x/dia — não há urgência de hora
 * em hora como o `billing/tick`, mas o mesmo cron pode chamar os dois).
 *
 * Resposta 200 sempre que autenticado, mesmo sem nada a purgar/anonimizar (`{ inboundEventsPurged:
 * 0, contactsAnonymized: 0 }`) — nunca 4xx por "não havia nada a fazer".
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!secret) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Cabeçalho Authorization ausente ou inválido." } }, { status: 401 });
  }

  const settings = await getPrisma().platformSettings.findUnique({ where: { id: 1 }, select: { internalApiSecretHash: true } });
  if (!settings?.internalApiSecretHash || !verifyInternalApiSecret(secret, settings.internalApiSecretHash)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Segredo inválido." } }, { status: 401 });
  }

  try {
    const summary = await runMaintenanceTick(new Date());
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    logger.error("maintenance.tick.route.unexpected_error", { errorMessage: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: { code: "INTERNAL", message: "Erro ao processar a manutenção periódica." } }, { status: 500 });
  }
}
