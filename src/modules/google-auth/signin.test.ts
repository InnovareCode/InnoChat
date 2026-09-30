import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";

/**
 * Decisão do callback `signIn` do Google (`resolveGoogleSignIn`): por `sub`, por e-mail (vínculo),
 * usuário novo (token de cadastro), e-mail não verificado, admin da plataforma e convite.
 */

const findUnique = vi.fn();
const updateMany = vi.fn();
vi.mock("@/lib/db/prisma", () => ({ getPrisma: () => ({ user: { findUnique, updateMany } }) }));

const acceptInviteWithGoogle = vi.fn();
vi.mock("@/modules/signup/service", () => ({ acceptInviteWithGoogle }));

beforeAll(() => {
  process.env.AUTH_SECRET = "unit-test-secret-com-mais-de-16-chars";
});

const { resolveGoogleSignIn } = await import("./signin");
const { verifyGoogleToken } = await import("./tokens");

const profile = { sub: "g-123", email: "Ana@Example.com", emailVerified: true, name: "Ana Souza" };

afterEach(() => vi.resetAllMocks());

describe("resolveGoogleSignIn", () => {
  it("recusa e-mail não verificado, sem tocar o banco", async () => {
    const out = await resolveGoogleSignIn({ ...profile, emailVerified: false });
    expect(out).toEqual({ kind: "deny", reason: "EMAIL_NOT_VERIFIED" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("recusa perfil sem e-mail", async () => {
    expect(await resolveGoogleSignIn({ ...profile, email: null })).toEqual({ kind: "deny", reason: "INVALID_PROFILE" });
  });

  it("entra direto quando já existe usuário com esse googleSub", async () => {
    findUnique.mockResolvedValueOnce({ id: "u1", isPlatformAdmin: false });
    expect(await resolveGoogleSignIn(profile)).toEqual({ kind: "allow", userId: "u1" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("vincula pelo e-mail: grava googleSub, verifica o e-mail e descarta a senha de conta não verificada", async () => {
    findUnique.mockResolvedValueOnce(null); // por sub
    findUnique.mockResolvedValueOnce({ id: "u2", email: "ana@example.com", googleSub: null, isPlatformAdmin: false, emailVerifiedAt: null, name: null });
    updateMany.mockResolvedValueOnce({ count: 1 });

    expect(await resolveGoogleSignIn(profile)).toEqual({ kind: "allow", userId: "u2" });

    expect(findUnique).toHaveBeenNthCalledWith(2, { where: { email: "ana@example.com" } });
    const call = updateMany.mock.calls[0]![0];
    expect(call.where).toEqual({ id: "u2", googleSub: null });
    expect(call.data.googleSub).toBe("g-123");
    expect(call.data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(call.data.passwordHash).toBeNull();
    expect(call.data.sessionVersion).toEqual({ increment: 1 }); // derruba a sessão que o atacante já abriu
    expect(call.data.name).toBe("Ana Souza");
  });

  it("vincula por e-mail SEM apagar a senha de quem já tinha e-mail verificado", async () => {
    findUnique.mockResolvedValueOnce(null);
    findUnique.mockResolvedValueOnce({ id: "u3", email: "ana@example.com", googleSub: null, isPlatformAdmin: false, emailVerifiedAt: new Date(), name: "Ana" });
    updateMany.mockResolvedValueOnce({ count: 1 });
    await resolveGoogleSignIn(profile);
    expect("passwordHash" in updateMany.mock.calls[0]![0].data).toBe(false);
    expect("sessionVersion" in updateMany.mock.calls[0]![0].data).toBe(false); // sessão do dono segue valendo
  });

  it("recusa quando o e-mail já está ligado a OUTRA conta Google", async () => {
    findUnique.mockResolvedValueOnce(null);
    findUnique.mockResolvedValueOnce({ id: "u4", googleSub: "outro", isPlatformAdmin: false, emailVerifiedAt: new Date() });
    expect(await resolveGoogleSignIn(profile)).toEqual({ kind: "deny", reason: "GOOGLE_ACCOUNT_MISMATCH" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("recusa admin da plataforma, por sub ou por e-mail", async () => {
    findUnique.mockResolvedValueOnce({ id: "adm", isPlatformAdmin: true });
    expect(await resolveGoogleSignIn(profile)).toEqual({ kind: "deny", reason: "PLATFORM_ADMIN" });

    findUnique.mockResolvedValueOnce(null);
    findUnique.mockResolvedValueOnce({ id: "adm", googleSub: null, isPlatformAdmin: true, emailVerifiedAt: new Date() });
    expect(await resolveGoogleSignIn(profile)).toEqual({ kind: "deny", reason: "PLATFORM_ADMIN" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("usuário novo: não cria nada e devolve token de cadastro com e-mail, nome e sub", async () => {
    findUnique.mockResolvedValue(null);
    const out = await resolveGoogleSignIn(profile);
    expect(out.kind).toBe("signup");
    if (out.kind !== "signup") return;
    const claims = verifyGoogleToken<{ email: string; name: string; sub: string }>("google-signup", out.token);
    expect(claims).toMatchObject({ email: "ana@example.com", name: "Ana Souza", sub: "g-123" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("convite: e-mail do Google diferente do convite é recusado", async () => {
    acceptInviteWithGoogle.mockRejectedValueOnce(new DomainError("INVITE_EMAIL_MISMATCH", "x"));
    expect(await resolveGoogleSignIn(profile, { inviteToken: "tok" })).toEqual({ kind: "deny", reason: "INVITE_EMAIL_MISMATCH" });
  });

  it("convite válido: entra como o usuário do convite", async () => {
    acceptInviteWithGoogle.mockResolvedValueOnce({ userId: "u9", tenantSlug: "t" });
    expect(await resolveGoogleSignIn(profile, { inviteToken: "tok" })).toEqual({ kind: "allow", userId: "u9" });
    expect(acceptInviteWithGoogle).toHaveBeenCalledWith("tok", { sub: "g-123", email: "ana@example.com", name: "Ana Souza" });
  });
});
