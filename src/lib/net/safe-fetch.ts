import { logger } from "@/lib/logger";

/**
 * Defesa SSRF leve para chamadas a URLs configuradas pelo admin da plataforma (revisão de
 * segurança 2026-09-28, achado MÉDIA — "Testar conexão" e a sincronização do n8n fazem
 * `fetch()` contra `evolutionApiUrl`/`n8nBaseUrl` como o admin digitou). O risco real é BAIXO
 * (só `requirePlatformAdmin()` chega até aqui — já é o papel de maior confiança do sistema), mas
 * vale a defesa em profundidade contra (a) uma conta admin comprometida usada para sondar a
 * rede interna da VPS, ou (b) erro humano do admin colando uma URL errada.
 *
 * Deliberadamente NÃO bloqueia IP privado/loopback em geral — a Evolution e o n8n do dono
 * costumam estar na MESMA rede interna do Easypanel (docs/contratos.md), então isso quebraria o
 * uso legítimo mais comum. Bloqueia só o que não tem nenhum caso de uso legítimo aqui:
 * - esquemas diferentes de `http`/`https` (ex.: `file:`, `gopher:`, `ftp:`);
 * - o endereço de metadados de nuvem `169.254.169.254` (AWS/GCP/Azure/DigitalOcean — nenhuma
 *   integração real aponta para lá, só um SSRF apontaria);
 * - redirecionamento para um HOST diferente do original (a URL configurada pode redirecionar
 *   dentro do mesmo host — ex. http→https — mas nunca para outro host, que é o vetor clássico
 *   de contornar a checagem inicial).
 */

const CLOUD_METADATA_HOST = "169.254.169.254";
const MAX_REDIRECTS = 5;

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function assertSafeExternalUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("URL inválida.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError(`Esquema não permitido: ${url.protocol}`);
  }

  if (url.hostname === CLOUD_METADATA_HOST) {
    throw new UnsafeUrlError("Endereço de metadados de nuvem bloqueado.");
  }

  return url;
}

/**
 * `fetch` com a checagem acima aplicada à URL inicial E a cada redirecionamento (nunca segue
 * para um host diferente do da requisição anterior) — usa `redirect: "manual"` e resolve o
 * `Location` manualmente, em vez de deixar o `fetch` nativo seguir redirects sozinho (que não
 * dá chance de validar o destino antes de ir).
 */
export async function safeFetch(rawUrl: string, init: RequestInit = {}): Promise<Response> {
  let currentUrl = assertSafeExternalUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      return response; // redirect sem Location — devolve como está, sem seguir.
    }

    const nextUrl = assertSafeExternalUrl(new URL(location, currentUrl).toString());
    if (nextUrl.hostname !== currentUrl.hostname) {
      logger.warn("net.safe_fetch.redirect_blocked", { fromHost: currentUrl.hostname, toHost: nextUrl.hostname });
      throw new UnsafeUrlError(`Redirecionamento para outro host bloqueado (${currentUrl.hostname} → ${nextUrl.hostname}).`);
    }

    currentUrl = nextUrl;
  }

  throw new UnsafeUrlError("Excesso de redirecionamentos.");
}
