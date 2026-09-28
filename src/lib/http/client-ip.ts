import { headers } from "next/headers";

/**
 * IP do cliente a partir dos headers do proxy reverso (Easypanel/Traefik, docs/arquitetura.md
 * §14) — mesma lógica antes duplicada em `signup/actions.ts`, `platform/install-actions.ts` e
 * agora `auth.ts`/`modules/auth/service.ts` (rate limit de login). Sem proxy reconhecido, cai
 * num valor fixo (`"unknown"`) — rate limit vira "global" nesse caso raro, o que é melhor que
 * quebrar o fluxo.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}
