import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Rate limit de login (revisão de segurança 2026-09-28, achado ALTA). `verifyCredentials` nunca
 * deve tocar `bcrypt.compare`/consultar o `User` depois que o teto (por IP OU por e-mail) foi
 * excedido — e o retorno é SEMPRE `null`, idêntico ao de "credencial inválida" (nunca revela
 * qual dos dois motivos, nem se a conta existe).
 */

const findUniqueMock = vi.fn();
vi.mock("@/lib/db/prisma", () => ({
  getPrisma: () => ({ user: { findUnique: findUniqueMock } }),
}));

const compareMock = vi.fn();
vi.mock("bcryptjs", () => ({
  default: { compare: compareMock, hash: vi.fn() },
}));

const { verifyCredentials } = await import("./service");
const { __resetRateLimitsForTests } = await import("@/lib/rate-limit");

afterEach(() => {
  vi.clearAllMocks();
  __resetRateLimitsForTests();
});

describe("verifyCredentials — rate limit por IP", () => {
  it("bloqueia a 21ª tentativa do mesmo IP dentro da janela, sem consultar o banco", async () => {
    findUniqueMock.mockResolvedValue(null);
    for (let i = 0; i < 20; i++) {
      await verifyCredentials({ email: `user${i}@example.com`, password: "x", ip: "203.0.113.9" });
    }
    findUniqueMock.mockClear();

    const result = await verifyCredentials({ email: "outra-conta@example.com", password: "x", ip: "203.0.113.9" });

    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});

describe("verifyCredentials — rate limit por e-mail", () => {
  it("bloqueia a 9ª tentativa da mesma conta mesmo vindo de IPs diferentes (CGNAT)", async () => {
    findUniqueMock.mockResolvedValue(null);
    for (let i = 0; i < 8; i++) {
      await verifyCredentials({ email: "vitima@example.com", password: "x", ip: `203.0.113.${i}` });
    }
    findUniqueMock.mockClear();

    const result = await verifyCredentials({ email: "vitima@example.com", password: "x", ip: "203.0.113.250" });

    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("normaliza e-mail (case/espaço) antes de contar — mesmo teto para Ana@X e ana@x ", async () => {
    findUniqueMock.mockResolvedValue(null);
    for (let i = 0; i < 8; i++) {
      await verifyCredentials({ email: " Vitima@Example.com ", password: "x", ip: `198.51.100.${i}` });
    }
    findUniqueMock.mockClear();

    const result = await verifyCredentials({ email: "vitima@example.com", password: "x", ip: "198.51.100.250" });

    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});

describe("verifyCredentials — não bloqueado, comportamento normal preservado", () => {
  it("dentro do teto, segue para o banco e devolve null em usuário inexistente", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await verifyCredentials({ email: "novo@example.com", password: "x", ip: "203.0.113.1" });
    expect(result).toBeNull();
    expect(findUniqueMock).toHaveBeenCalledOnce();
  });

  it("dentro do teto, senha correta devolve o usuário", async () => {
    findUniqueMock.mockResolvedValue({ id: "u1", email: "ok@example.com", name: "Ok User", passwordHash: "hash" });
    compareMock.mockResolvedValue(true);
    const result = await verifyCredentials({ email: "ok@example.com", password: "correta", ip: "203.0.113.2" });
    expect(result).toEqual({ id: "u1", email: "ok@example.com", name: "Ok User" });
  });
});
