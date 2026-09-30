import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => ({ user: { findUnique, update } }) }));

const { SESSION_VERSION_CACHE_TTL_MS, clearSessionVersionCache, forgetSessionVersion, isSessionVersionCurrent, readSessionVersion, signOutEverywhere } = await import("./session-version");

beforeEach(() => {
  vi.resetAllMocks();
  clearSessionVersionCache();
});

describe("readSessionVersion — cache curto (sem 1 query por request)", () => {
  it("lê uma vez e serve do cache dentro do TTL", async () => {
    findUnique.mockResolvedValue({ sessionVersion: 3 });
    expect(await readSessionVersion("u1", { nowMs: 1000 })).toBe(3);
    expect(await readSessionVersion("u1", { nowMs: 1000 + SESSION_VERSION_CACHE_TTL_MS - 1 })).toBe(3);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("depois do TTL relê o banco (revogação em outra instância vale em poucos segundos)", async () => {
    findUnique.mockResolvedValueOnce({ sessionVersion: 3 }).mockResolvedValueOnce({ sessionVersion: 4 });
    await readSessionVersion("u1", { nowMs: 1000 });
    expect(await readSessionVersion("u1", { nowMs: 1000 + SESSION_VERSION_CACHE_TTL_MS })).toBe(4);
  });

  it("fresh ignora o cache; forget derruba a entrada", async () => {
    findUnique.mockResolvedValueOnce({ sessionVersion: 1 }).mockResolvedValueOnce({ sessionVersion: 2 }).mockResolvedValueOnce({ sessionVersion: 5 });
    await readSessionVersion("u1", { nowMs: 1 });
    expect(await readSessionVersion("u1", { nowMs: 2, fresh: true })).toBe(2);
    forgetSessionVersion("u1");
    expect(await readSessionVersion("u1", { nowMs: 3 })).toBe(5);
  });

  it("usuário inexistente devolve null (sessão deve cair)", async () => {
    findUnique.mockResolvedValue(null);
    expect(await readSessionVersion("ghost")).toBeNull();
  });

  it("signOutEverywhere incrementa e esquece o cache local", async () => {
    findUnique.mockResolvedValueOnce({ sessionVersion: 0 }).mockResolvedValueOnce({ sessionVersion: 1 });
    await readSessionVersion("u1", { nowMs: 1 });
    await signOutEverywhere("u1");
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { sessionVersion: { increment: 1 } } });
    expect(await readSessionVersion("u1", { nowMs: 2 })).toBe(1);
  });
});

describe("isSessionVersionCurrent", () => {
  it("compara igual; ausente conta como 0 (tokens emitidos antes do recurso)", () => {
    expect(isSessionVersionCurrent(2, 2)).toBe(true);
    expect(isSessionVersionCurrent(1, 2)).toBe(false);
    expect(isSessionVersionCurrent(undefined, 0)).toBe(true);
    expect(isSessionVersionCurrent(undefined, 1)).toBe(false);
  });
});
