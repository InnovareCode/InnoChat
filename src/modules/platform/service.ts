import crypto from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { maskSecret } from "@/lib/mask";

/**
 * Visão segura de `PlatformSettings` para a UI de admin (docs/arquitetura.md §5, §9, §11):
 * segredos NUNCA voltam em texto puro — só mascarados (últimos 4 caracteres) ou como booleano
 * "configurado". `internalApiSecretHash` nunca é exposto, nem mascarado: é hash, não segredo
 * reversível, e o valor em texto puro só existe no instante em que é gerado
 * (`regenerateInternalApiSecret`).
 */
export type PlatformSettingsView = {
  evolutionApiUrl: string | null;
  evolutionApiKeyMasked: string | null;
  n8nWebhookBaseUrl: string | null;
  internalApiSecretConfigured: boolean;
  mercadoPagoAccessTokenMasked: string | null;
  mercadoPagoWebhookSecretMasked: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPasswordMasked: string | null;
  smtpFrom: string | null;
  termsVersion: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

type PlatformSettingsRow = {
  evolutionApiUrl: string | null;
  evolutionApiKey: string | null;
  n8nWebhookBaseUrl: string | null;
  internalApiSecretHash: string | null;
  mercadoPagoAccessToken: string | null;
  mercadoPagoWebhookSecret: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  termsVersion: string | null;
  updatedAt: Date;
  updatedByUserId: string | null;
} | null;

function toView(row: PlatformSettingsRow): PlatformSettingsView {
  if (!row) {
    return {
      evolutionApiUrl: null,
      evolutionApiKeyMasked: null,
      n8nWebhookBaseUrl: null,
      internalApiSecretConfigured: false,
      mercadoPagoAccessTokenMasked: null,
      mercadoPagoWebhookSecretMasked: null,
      smtpHost: null,
      smtpPort: null,
      smtpSecure: null,
      smtpUser: null,
      smtpPasswordMasked: null,
      smtpFrom: null,
      termsVersion: null,
      updatedAt: null,
      updatedByUserId: null,
    };
  }

  return {
    evolutionApiUrl: row.evolutionApiUrl,
    evolutionApiKeyMasked: maskSecret(row.evolutionApiKey),
    n8nWebhookBaseUrl: row.n8nWebhookBaseUrl,
    internalApiSecretConfigured: !!row.internalApiSecretHash,
    mercadoPagoAccessTokenMasked: maskSecret(row.mercadoPagoAccessToken),
    mercadoPagoWebhookSecretMasked: maskSecret(row.mercadoPagoWebhookSecret),
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser,
    smtpPasswordMasked: maskSecret(row.smtpPassword),
    smtpFrom: row.smtpFrom,
    termsVersion: row.termsVersion,
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
  };
}

export async function getMaskedPlatformSettings(): Promise<PlatformSettingsView> {
  const row = await getPrisma().platformSettings.findUnique({ where: { id: 1 } });
  return toView(row);
}

/**
 * Entrada de atualização: todo campo de texto/segredo é OPCIONAL — string vazia ou ausente
 * significa "manter o valor atual" (contrato pedido pelo dono). Isso é o que permite a tela
 * de admin nunca precisar reenviar um segredo que ela nem consegue ler de volta.
 */
export type PlatformSettingsInput = {
  evolutionApiUrl?: string;
  evolutionApiKey?: string;
  n8nWebhookBaseUrl?: string;
  mercadoPagoAccessToken?: string;
  mercadoPagoWebhookSecret?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  termsVersion?: string;
};

function keepIfEmpty(incoming: string | undefined, existing: string | null | undefined): string | null {
  if (incoming === undefined || incoming === "") return existing ?? null;
  return incoming;
}

export async function updatePlatformSettings(input: PlatformSettingsInput, updatedByUserId: string): Promise<PlatformSettingsView> {
  const prisma = getPrisma();
  const current = await prisma.platformSettings.findUnique({ where: { id: 1 } });

  const data = {
    evolutionApiUrl: keepIfEmpty(input.evolutionApiUrl, current?.evolutionApiUrl),
    evolutionApiKey: keepIfEmpty(input.evolutionApiKey, current?.evolutionApiKey),
    n8nWebhookBaseUrl: keepIfEmpty(input.n8nWebhookBaseUrl, current?.n8nWebhookBaseUrl),
    mercadoPagoAccessToken: keepIfEmpty(input.mercadoPagoAccessToken, current?.mercadoPagoAccessToken),
    mercadoPagoWebhookSecret: keepIfEmpty(input.mercadoPagoWebhookSecret, current?.mercadoPagoWebhookSecret),
    smtpHost: keepIfEmpty(input.smtpHost, current?.smtpHost),
    smtpPort: input.smtpPort ?? current?.smtpPort ?? null,
    smtpSecure: input.smtpSecure ?? current?.smtpSecure ?? null,
    smtpUser: keepIfEmpty(input.smtpUser, current?.smtpUser),
    smtpPassword: keepIfEmpty(input.smtpPassword, current?.smtpPassword),
    smtpFrom: keepIfEmpty(input.smtpFrom, current?.smtpFrom),
    termsVersion: keepIfEmpty(input.termsVersion, current?.termsVersion),
    updatedByUserId,
  };

  const row = await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  return toView(row);
}

const INTERNAL_SECRET_BYTES = 32;

/**
 * Gera um novo segredo da API interna (n8n → painel, docs/arquitetura.md §6.1), devolve o
 * valor em texto puro UMA ÚNICA VEZ (para a tela mostrar e o dono copiar) e persiste só o
 * hash SHA-256 — nunca o segredo em si.
 */
export async function regenerateInternalApiSecret(updatedByUserId: string): Promise<{ secret: string }> {
  const secret = crypto.randomBytes(INTERNAL_SECRET_BYTES).toString("base64url");
  const internalApiSecretHash = hashInternalApiSecret(secret);

  await getPrisma().platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, internalApiSecretHash, updatedByUserId },
    update: { internalApiSecretHash, updatedByUserId },
  });

  return { secret };
}

export function hashInternalApiSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

/**
 * Comparação em tempo constante (docs/arquitetura.md §6.1) — para a Fase 4 validar o header
 * `Authorization: Bearer <secret>` da API interna contra o hash guardado sem vazar timing.
 */
export function verifyInternalApiSecret(secret: string, hash: string): boolean {
  const candidate = Buffer.from(hashInternalApiSecret(secret));
  const expected = Buffer.from(hash);
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}
