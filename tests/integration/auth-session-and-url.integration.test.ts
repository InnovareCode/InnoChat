/**
 * Auth.js de verdade (route handler `/api/auth/*`) contra Postgres real:
 *  - I1: uma sessão JWT aberta ANTES do vínculo Google/reset de senha deixa de valer depois.
 *  - I3: `Host`/`X-Forwarded-Host` forjados NÃO mudam o `callbackUrl`/`redirect_uri` — sai da
 *    `PlatformSettings.publicBaseUrl` gravada pelo admin.
 *
 * Roda com `AUTH_URL` vazio (o config de integração o define; aqui é zerado antes de importar
 * `@/lib/auth`) para exercitar o `pinAuthUrlToTrustedBase`. Nenhum Google real: o provedor só
 * precisa estar ligado para aparecer em `/api/auth/providers`.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";
import { getPrisma } from "@/lib/db/prisma";

const sent: { to: string; text: string }[] = [];

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    ...actual,
    sendMail: vi.fn(async (m: { to: string; text: string }) => {
      sent.push(m);
      return { sent: true };
    }),
  };
});

vi.stubEnv("AUTH_URL", "");
vi.stubEnv("NEXTAUTH_URL", "");
vi.stubEnv("AUTH_SECRET", "integration-secret-for-auth-session-tests-0123456789");

const { NextRequest } = await import("next/server");
const { GET } = (await import("@/lib/auth")).handlers;
const { resolveGoogleSignIn } = await import("@/modules/google-auth/signin");
const { requestPasswordReset, resetPassword } = await import("@/modules/signup/service");
const { signOutEverywhere, clearSessionVersionCache } = await import("@/modules/auth/session-version");
const { clearTrustedPublicBaseUrlCache } = await import("@/lib/public-url");
const config = await import("@/modules/google-auth/config");
const { encryptSecret } = await import("@/lib/crypto");

const prisma = getPrisma();
const run = randomUUID().slice(0, 8);
const TRUSTED = "https://painel.confiavel.test";
const COOKIE = "__Secure-authjs.session-token"; // origem https => prefixo __Secure-
const createdUserIds: string[] = [];
let originalBase: string | null = null;

async function sessionCookieFor(userId: string, sv: number | undefined): Promise<string> {
  const token: Record<string, unknown> = { userId, sub: userId };
  if (sv !== undefined) token.sv = sv;
  const jwt = await encode({ token, secret: process.env.AUTH_SECRET!, salt: COOKIE, maxAge: 3600 });
  return `${COOKIE}=${jwt}`;
}

async function readSession(cookie: string) {
  const res = await GET(new NextRequest(`${TRUSTED}/api/auth/session`, { headers: { cookie } }));
  return (await res.json()) as { user?: { id: string } } | null;
}

async function makeUser(label: string, verified: boolean) {
  const u = await prisma.user.create({
    data: { email: `it-authsess-${label}-${run}@example.com`, passwordHash: "$2b$10$placeholderplaceholderplaceholderplaceholderplaceholder", emailVerifiedAt: verified ? new Date() : null },
  });
  createdUserIds.push(u.id);
  return u;
}

beforeAll(async () => {
  originalBase = (await prisma.platformSettings.findUnique({ where: { id: 1 }, select: { publicBaseUrl: true } }))?.publicBaseUrl ?? null;
  await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, publicBaseUrl: TRUSTED }, update: { publicBaseUrl: TRUSTED } });
  clearTrustedPublicBaseUrlCache();
});

afterAll(async () => {
  await prisma.platformSettings.updateMany({ where: { id: 1 }, data: { publicBaseUrl: originalBase, googleAuthEnabled: false, googleClientId: null, googleClientSecretEnc: null } });
  await prisma.authToken.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("I1 - a sessão aberta antes da revogação deixa de valer", () => {
  it("sessão válida enquanto a versão bate", async () => {
    const u = await makeUser("ok", true);
    const session = await readSession(await sessionCookieFor(u.id, 0));
    expect(session?.user?.id).toBe(u.id);
  });

  it("vínculo Google em conta NÃO verificada: a sessão antiga do atacante cai", async () => {
    const u = await makeUser("link", false);
    const attackerCookie = await sessionCookieFor(u.id, 0);
    expect((await readSession(attackerCookie))?.user?.id).toBe(u.id);

    const out = await resolveGoogleSignIn({ sub: `sub-authsess-${run}`, email: u.email, emailVerified: true });
    expect(out).toEqual({ kind: "allow", userId: u.id });

    expect(await readSession(attackerCookie)).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).sessionVersion).toBe(1);
  });

  it("vínculo em conta JÁ verificada não derruba a sessão (a senha é do dono)", async () => {
    const u = await makeUser("linkverified", true);
    const cookie = await sessionCookieFor(u.id, 0);
    await resolveGoogleSignIn({ sub: `sub-authsess-v-${run}`, email: u.email, emailVerified: true });
    expect((await readSession(cookie))?.user?.id).toBe(u.id);
  });

  it("redefinir a senha derruba as sessões abertas", async () => {
    const u = await makeUser("reset", true);
    const cookie = await sessionCookieFor(u.id, 0);
    expect((await readSession(cookie))?.user?.id).toBe(u.id);

    sent.length = 0;
    await requestPasswordReset(u.email);
    const raw = sent.find((m) => m.to === u.email)?.text.match(/token=([\w-]+)/)?.[1];
    expect(raw).toBeTruthy();
    await resetPassword(raw!, "nova-senha-forte-123");

    expect(await readSession(cookie)).toBeNull();
  });

  it("sair de todos os dispositivos derruba as sessões abertas (e a sessão nova vale)", async () => {
    const u = await makeUser("all", true);
    const cookie = await sessionCookieFor(u.id, 0);
    await signOutEverywhere(u.id);
    expect(await readSession(cookie)).toBeNull();
    expect((await readSession(await sessionCookieFor(u.id, 1)))?.user?.id).toBe(u.id);
  });

  it("token antigo sem sv conta como versão 0 (não desloga todo mundo no deploy)", async () => {
    const u = await makeUser("legacy", true);
    expect((await readSession(await sessionCookieFor(u.id, undefined)))?.user?.id).toBe(u.id);
  });

  it("usuário removido: sessão cai", async () => {
    const u = await makeUser("gone", true);
    const cookie = await sessionCookieFor(u.id, 0);
    clearSessionVersionCache();
    await prisma.user.delete({ where: { id: u.id } });
    expect(await readSession(cookie)).toBeNull();
  });
});

describe("I3 - host forjado não muda a URL do Auth.js nem o link do e-mail", () => {
  it("/api/auth/providers: callbackUrl (Google e senha) usa a base confiável, não o Host forjado", async () => {
    await prisma.platformSettings.update({
      where: { id: 1 },
      data: { googleAuthEnabled: true, googleClientId: ["1234567890-abcdefghijk", "apps", "googleusercontent", "com"].join("."), googleClientSecretEnc: encryptSecret(["GOCSPX", "x"].join("-")) },
    });
    config.invalidateGoogleAuthCache();

    const req = new NextRequest("http://evil.example/api/auth/providers", {
      headers: { host: "evil.example", "x-forwarded-host": "evil.example", "x-forwarded-proto": "http" },
    });
    const res = await GET(req);
    const providers = (await res.json()) as Record<string, { callbackUrl: string }>;
    expect(providers.google?.callbackUrl).toBe(`${TRUSTED}/api/auth/callback/google`);
    expect(providers.credentials?.callbackUrl.startsWith(TRUSTED)).toBe(true);
    expect(JSON.stringify(providers)).not.toContain("evil.example");
  });

  it("link do e-mail de redefinir senha sai da base gravada", async () => {
    const u = await makeUser("hostreset", true);
    sent.length = 0;
    await requestPasswordReset(u.email);
    const mail = sent.find((m) => m.to === u.email);
    expect(mail?.text).toContain(`${TRUSTED}/redefinir-senha?token=`);
  });
});
