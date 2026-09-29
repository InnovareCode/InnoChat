import crypto from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { maskSecret } from "@/lib/mask";

/**
 * Visão segura de `PlatformSettings` para a UI de admin (docs/arquitetura.md §5, §9, §11):
 * segredos NUNCA voltam em texto puro — só mascarados (últimos 4 caracteres) ou como booleano
 * "configurado". `internalApiSecretHash` nunca é exposto, nem mascarado: é hash, não segredo
 * reversível, e o valor em texto puro só existe no instante em que é gerado
 * (`regenerateInternalApiSecret`).
 *
 * NOTA (decisão do dono, 2026-09-29): `PlatformSettings.termsVersion` deixou de ser lido/gravado
 * aqui — duplicava `TERMS_VERSION` (`src/lib/legal.ts`), a fonte única real que o cadastro
 * público confere (`assertCurrentTermsVersion`), e nunca havia tela de admin editando este
 * campo (nenhuma referência em `src/app`). A coluna continua no schema (nenhuma migration
 * destrutiva) — proposta para o Cronos: uma migration futura pode removê-la quando convier,
 * já que nenhum código lê/escreve nela a partir de agora.
 */
export type PlatformSettingsView = {
  // Só leitura — nunca vem de `PlatformSettingsInput` (gravado sozinho a partir da requisição,
  // `src/lib/public-url.ts`). Exibido para o admin conferir o que o sistema está usando.
  publicBaseUrl: string | null;
  evolutionApiUrl: string | null;
  evolutionApiKeyMasked: string | null;
  n8nWebhookBaseUrl: string | null;
  n8nBaseUrl: string | null;
  n8nApiKeyMasked: string | null;
  internalApiSecretConfigured: boolean;
  mercadoPagoAccessTokenMasked: string | null;
  mercadoPagoWebhookSecretMasked: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPasswordMasked: string | null;
  smtpFrom: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

type PlatformSettingsRow = {
  publicBaseUrl: string | null;
  evolutionApiUrl: string | null;
  evolutionApiKey: string | null;
  n8nWebhookBaseUrl: string | null;
  n8nBaseUrl: string | null;
  n8nApiKey: string | null;
  internalApiSecretHash: string | null;
  mercadoPagoAccessToken: string | null;
  mercadoPagoWebhookSecret: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  updatedAt: Date;
  updatedByUserId: string | null;
} | null;

function toView(row: PlatformSettingsRow): PlatformSettingsView {
  if (!row) {
    return {
      publicBaseUrl: null,
      evolutionApiUrl: null,
      evolutionApiKeyMasked: null,
      n8nWebhookBaseUrl: null,
      n8nBaseUrl: null,
      n8nApiKeyMasked: null,
      internalApiSecretConfigured: false,
      mercadoPagoAccessTokenMasked: null,
      mercadoPagoWebhookSecretMasked: null,
      smtpHost: null,
      smtpPort: null,
      smtpSecure: null,
      smtpUser: null,
      smtpPasswordMasked: null,
      smtpFrom: null,
      updatedAt: null,
      updatedByUserId: null,
    };
  }

  return {
    publicBaseUrl: row.publicBaseUrl,
    evolutionApiUrl: row.evolutionApiUrl,
    evolutionApiKeyMasked: maskSecret(row.evolutionApiKey),
    n8nWebhookBaseUrl: row.n8nWebhookBaseUrl,
    n8nBaseUrl: row.n8nBaseUrl,
    n8nApiKeyMasked: maskSecret(row.n8nApiKey),
    internalApiSecretConfigured: !!row.internalApiSecretHash,
    mercadoPagoAccessTokenMasked: maskSecret(row.mercadoPagoAccessToken),
    mercadoPagoWebhookSecretMasked: maskSecret(row.mercadoPagoWebhookSecret),
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser,
    smtpPasswordMasked: maskSecret(row.smtpPassword),
    smtpFrom: row.smtpFrom,
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
  };
}

/**
 * Segredos salvos em claro, SÓ para uso no servidor (ex.: "Testar conexão" com o campo da chave em
 * branco usa a chave já salva). Nunca devolver o resultado disto ao client.
 */
export async function getSavedIntegrationSecrets() {
  const row = await getPrisma().platformSettings.findUnique({
    where: { id: 1 },
    select: { evolutionApiKey: true, n8nApiKey: true, mercadoPagoAccessToken: true, smtpPassword: true },
  });
  return {
    evolutionApiKey: row?.evolutionApiKey ?? null,
    n8nApiKey: row?.n8nApiKey ?? null,
    mercadoPagoAccessToken: row?.mercadoPagoAccessToken ?? null,
    smtpPassword: row?.smtpPassword ?? null,
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
  n8nBaseUrl?: string;
  n8nApiKey?: string;
  mercadoPagoAccessToken?: string;
  mercadoPagoWebhookSecret?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
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
    n8nBaseUrl: keepIfEmpty(input.n8nBaseUrl, current?.n8nBaseUrl),
    n8nApiKey: keepIfEmpty(input.n8nApiKey, current?.n8nApiKey),
    mercadoPagoAccessToken: keepIfEmpty(input.mercadoPagoAccessToken, current?.mercadoPagoAccessToken),
    mercadoPagoWebhookSecret: keepIfEmpty(input.mercadoPagoWebhookSecret, current?.mercadoPagoWebhookSecret),
    smtpHost: keepIfEmpty(input.smtpHost, current?.smtpHost),
    smtpPort: input.smtpPort ?? current?.smtpPort ?? null,
    smtpSecure: input.smtpSecure ?? current?.smtpSecure ?? null,
    smtpUser: keepIfEmpty(input.smtpUser, current?.smtpUser),
    smtpPassword: keepIfEmpty(input.smtpPassword, current?.smtpPassword),
    smtpFrom: keepIfEmpty(input.smtpFrom, current?.smtpFrom),
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
