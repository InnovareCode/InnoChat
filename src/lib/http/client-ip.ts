import { isIP } from "node:net";
import { headers } from "next/headers";

/**
 * IP do cliente a partir dos headers do proxy reverso (Easypanel/Traefik, docs/arquitetura.md
 * §14) — usado pelo rate limit de login/cadastro (`auth.ts`, `modules/auth/service.ts`,
 * `signup/actions.ts`, `platform/install-actions.ts`).
 *
 * SUPOSIÇÃO (revisão do Órion S4): há exatamente `TRUSTED_PROXY_HOPS` = 1 proxy confiável na frente
 * do app (o Traefik do Easypanel), e ele ACRESCENTA o IP de quem conectou ao FIM de
 * `X-Forwarded-For`. O 1º valor da lista é o que o cliente mandou — forjável (`X-Forwarded-For:
 * 1.2.3.4` faria cada requisição contar num "IP" novo e fugir do rate limit). Por isso usa-se o
 * valor a `TRUSTED_PROXY_HOPS` posições do fim, adicionado por quem confiamos. Se um dia entrar um
 * 2º proxy (ex.: Cloudflare na frente do Traefik), suba `TRUSTED_PROXY_HOPS` para 2 — senão o
 * "cliente" passa a ser o IP do proxy externo (rate limit vira compartilhado, nunca burlável).
 *
 * Fallback: sem XFF válido usa `X-Real-IP` (também validado como IP); sem nada, `"unknown"`
 * (rate limit "global" nesse caso raro — melhor que quebrar o fluxo). Valores que não são um IP
 * (`isIP`) são ignorados: nunca viram chave de rate limit nem entram em log.
 */
export const TRUSTED_PROXY_HOPS = 1;

export function pickClientIp(forwardedFor: string | null, realIp: string | null, hops = TRUSTED_PROXY_HOPS): string {
  if (forwardedFor) {
    const parts = forwardedFor.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) {
      const candidate = parts[Math.max(0, parts.length - hops)]!;
      if (isIP(candidate)) return candidate;
    }
  }
  const real = realIp?.trim();
  if (real && isIP(real)) return real;
  return "unknown";
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return pickClientIp(h.get("x-forwarded-for"), h.get("x-real-ip"));
}
