import { NextResponse } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

/**
 * Health check do serviço `innochat-painel`, para o orquestrador (Easypanel) decidir se o
 * container está pronto para receber tráfego e se deve reiniciar/reverter um deploy.
 *
 * Checagem LEVE de propósito: `SELECT 1` prova que o processo consegue abrir conexão e falar
 * com o Postgres configurado em `DATABASE_URL` — não é um "smoke test" completo (não toca
 * tabela de negócio, não depende de `PlatformSettings` já ter sido configurado). Sem isso, um
 * healthcheck que só confirma "o processo Node está de pé" (ex.: sempre `200`) deixaria o
 * Easypanel considerar saudável um container com banco inacessível.
 *
 * NUNCA expõe detalhe de erro (stack, mensagem do driver, connection string) na resposta —
 * só loga o suficiente para investigar (`logger.error`, sem segredo) e devolve genérico.
 * `force-dynamic`: nunca cachear nem tentar pré-renderizar isto (é sempre uma checagem ao
 * vivo, nunca estático).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    logger.error("health.db_unreachable", {
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
