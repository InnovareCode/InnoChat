import { describe, expect, it } from "vitest";

// `client-ip.ts` importa `next/headers`; só a função pura interessa aqui.
import { vi } from "vitest";
vi.mock("next/headers", () => ({ headers: vi.fn() }));
const { pickClientIp, TRUSTED_PROXY_HOPS } = await import("./client-ip");

describe("pickClientIp (1 proxy confiável = Traefik, que ACRESCENTA ao fim do X-Forwarded-For)", () => {
  it("usa o ÚLTIMO valor, não o primeiro (o primeiro é forjável pelo cliente)", () => {
    expect(TRUSTED_PROXY_HOPS).toBe(1);
    expect(pickClientIp("6.6.6.6, 203.0.113.9", null)).toBe("203.0.113.9");
    expect(pickClientIp("1.1.1.1, 2.2.2.2, 203.0.113.9", null)).toBe("203.0.113.9");
  });

  it("valor único é o do proxy", () => {
    expect(pickClientIp("203.0.113.9", null)).toBe("203.0.113.9");
  });

  it("2 proxies confiáveis: pega o penúltimo", () => {
    expect(pickClientIp("6.6.6.6, 203.0.113.9, 10.0.0.2", null, 2)).toBe("203.0.113.9");
  });

  it("aceita IPv6", () => {
    expect(pickClientIp("2001:db8::1", null)).toBe("2001:db8::1");
  });

  it("lixo no XFF cai para X-Real-IP válido, e sem nada vira unknown", () => {
    expect(pickClientIp("nao-e-ip", "198.51.100.7")).toBe("198.51.100.7");
    expect(pickClientIp("<script>", "tambem-nao")).toBe("unknown");
    expect(pickClientIp(null, null)).toBe("unknown");
    expect(pickClientIp("", "")).toBe("unknown");
  });
});
