import { headers } from "next/headers";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";

/**
 * URL pública do painel — decisão do dono (2026-09-28): nenhuma URL/credencial solta em env
 * var. `AUTH_URL`/`NEXT_PUBLIC_APP_URL` saíram de `src/env.ts` (agora opcionais, sem uso em
 * runtime); todo link de e-mail, `n8nWebhookBaseUrl` mostrado ao admin e a URL do painel
 * enviada ao n8n passam por aqui.
 *
 * Prioridade:
 *  1. Cabeçalhos da própria requisição (`x-forwarded-proto`/`x-forwarded-host`, com fallback
 *     para `host`) — sempre corretos, o Easypanel/Traefik já os popula (mesma base de
 *     `trustHost` em `src/lib/auth.ts`). Cobre toda Server Action e toda rota de API chamada
 *     através do domínio público.
 *  2. `PlatformSettings.publicBaseUrl` — só entra quando (1) não está disponível: fora de uma
 *     requisição (ex.: um job chamado diretamente em processo, não via HTTP). Gravado
 *     sozinho na 1ª vez que um admin salva Configurações (`ensurePublicBaseUrlStored`),
 *     nunca editado à mão.
 *
 * Nunca lança durante uma requisição normal (sempre há cabeçalhos). Só lança fora de uma
 * requisição sem `publicBaseUrl` configurado ainda (ex.: tick rodando antes do primeiro admin
 * salvar Configurações) — quem chama decide se isso é fatal ali (ver `docs/contratos.md`).
 */
export async function getPublicBaseUrl(): Promise<string> {
  const fromRequest = await tryBaseUrlFromRequestHeaders();
  if (fromRequest) return fromRequest;

  const stored = await getStoredPublicBaseUrl();
  if (stored) return stored;

  throw new DomainError(
    "PUBLIC_URL_UNKNOWN",
    "URL pública do painel ainda não configurada. Acesse Admin > Configurações uma vez para gravá-la automaticamente.",
  );
}

/**
 * Igual a `getPublicBaseUrl`, mas nunca lança — usada em caminhos que já têm um fallback
 * aceitável (ex.: exibir "não configurada" na tela em vez de quebrar a página).
 */
export async function tryGetPublicBaseUrl(): Promise<string | null> {
  try {
    return await getPublicBaseUrl();
  } catch {
    return null;
  }
}

async function tryBaseUrlFromRequestHeaders(): Promise<string | null> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (!host) return null;
    const proto = h.get("x-forwarded-proto") ?? "https";
    // `x-forwarded-proto`/`x-forwarded-host` podem vir com múltiplos valores separados por
    // vírgula quando há mais de um proxy na cadeia — o mais próximo do cliente vem primeiro.
    const firstHost = host.split(",")[0]!.trim();
    const firstProto = proto.split(",")[0]!.trim();
    return `${firstProto}://${firstHost}`;
  } catch {
    // `headers()` lança fora de um escopo de requisição (Server Action/Route Handler/RSC) —
    // é o caso do job/tick chamado fora do handler HTTP.
    return null;
  }
}

export async function getStoredPublicBaseUrl(): Promise<string | null> {
  const settings = await getPrisma().platformSettings.findUnique({ where: { id: 1 }, select: { publicBaseUrl: true } });
  return settings?.publicBaseUrl ?? null;
}

/**
 * Grava `publicBaseUrl` a partir da requisição atual — chamada de dentro de uma Server Action
 * que já roda com sessão de admin (`updatePlatformSettingsAction`). Nunca sobrescreve um valor
 * já gravado: se o domínio mudar, é o admin quem decide trocar (fora do escopo da v1 — não há
 * tela para editar isto à mão, de propósito, para não reabrir a porta de "URL solta").
 */
export async function ensurePublicBaseUrlFromCurrentRequest(): Promise<void> {
  const candidate = await tryBaseUrlFromRequestHeaders();
  if (!candidate) return;

  const prisma = getPrisma();
  const current = await prisma.platformSettings.findUnique({ where: { id: 1 }, select: { publicBaseUrl: true } });
  if (current?.publicBaseUrl) return;

  await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, publicBaseUrl: candidate },
    update: { publicBaseUrl: candidate },
  });
}
