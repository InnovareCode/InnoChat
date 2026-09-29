import type { MercadoPagoEnvironment, Prisma, PlatformSettings } from "@/lib/db/types";
import { getPrisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { loadPlatformSettingsRow, readEncryptedSecret } from "./secrets";

/**
 * Credenciais do Mercado Pago no modelo do Parque das Feiras: par de PRODUÇÃO e par de TESTE
 * (sandbox), com `mpEnvironment` escolhendo o par ATIVO. Public Key fica em claro (não é
 * segredo); Access Token e Webhook Secret são cifrados (`src/lib/crypto.ts`).
 *
 * FAIL-CLOSED: segredo que não decifra vale como ausente — sem access token o Pix não é gerado
 * (`getMercadoPagoGateway` lança `MERCADOPAGO_NOT_CONFIGURED`), sem webhook secret o webhook é
 * rejeitado. `mpEnabled=false` bloqueia só COBRANÇA NOVA; webhook e conciliação seguem valendo.
 *
 * NUNCA logue o valor de um token/segredo aqui — só presença/ausência e o ambiente.
 */

export type MercadoPagoEnv = MercadoPagoEnvironment;
export type MercadoPagoSecretField = "accessToken" | "webhookSecret";

export type ActiveMercadoPagoCredentials = {
  environment: MercadoPagoEnv;
  enabled: boolean;
  publicKey: string | null;
  accessToken: string | null;
  webhookSecret: string | null;
};

/** O que a UI pode ver: nunca o valor dos segredos, só se estão salvos (e decifram). */
export type MercadoPagoEnvView = { publicKey: string | null; accessTokenSaved: boolean; webhookSecretSaved: boolean };
export type MercadoPagoConfigView = {
  environment: MercadoPagoEnv;
  enabled: boolean;
  production: MercadoPagoEnvView;
  sandbox: MercadoPagoEnvView;
};

const COLUMNS = {
  PRODUCTION: { publicKey: "mpProdPublicKey", accessToken: "mpProdAccessTokenEnc", webhookSecret: "mpProdWebhookSecretEnc" },
  SANDBOX: { publicKey: "mpTestPublicKey", accessToken: "mpTestAccessTokenEnc", webhookSecret: "mpTestWebhookSecretEnc" },
} as const;

function readPair(row: PlatformSettings | null, env: MercadoPagoEnv) {
  const cols = COLUMNS[env];
  return {
    publicKey: row?.[cols.publicKey] ?? null,
    accessToken: readEncryptedSecret(row?.[cols.accessToken], cols.accessToken),
    webhookSecret: readEncryptedSecret(row?.[cols.webhookSecret], cols.webhookSecret),
  };
}

/**
 * Par ATIVO (o do ambiente selecionado). Usado pelo adaptador do gateway, pelo webhook (assinatura),
 * pelo tick, pelo "Gerar Pix" e pelo checklist. Banco sem linha => nada configurado.
 */
export async function getActiveMercadoPagoCredentials(): Promise<ActiveMercadoPagoCredentials> {
  const row = await loadPlatformSettingsRow();
  const environment = row?.mpEnvironment ?? "PRODUCTION";
  return { environment, enabled: row?.mpEnabled ?? true, ...readPair(row, environment) };
}

/** Par de credenciais de um ambiente específico (não o ativo) — conciliação por `Invoice.mpEnvironment`. */
export async function getMercadoPagoCredentials(env: MercadoPagoEnv) {
  return readPair(await loadPlatformSettingsRow(), env);
}

function toEnvView(row: PlatformSettings | null, env: MercadoPagoEnv): MercadoPagoEnvView {
  const pair = readPair(row, env);
  return { publicKey: pair.publicKey, accessTokenSaved: !!pair.accessToken, webhookSecretSaved: !!pair.webhookSecret };
}

function toConfigView(row: PlatformSettings | null): MercadoPagoConfigView {
  return {
    environment: row?.mpEnvironment ?? "PRODUCTION",
    enabled: row?.mpEnabled ?? true,
    production: toEnvView(row, "PRODUCTION"),
    sandbox: toEnvView(row, "SANDBOX"),
  };
}

export async function getMercadoPagoConfig(): Promise<MercadoPagoConfigView> {
  return toConfigView(await loadPlatformSettingsRow());
}

/** "Mercado Pago configurado" (checklist) = par ATIVO com access token e webhook secret salvos. */
export async function isMercadoPagoConfigured(): Promise<boolean> {
  const active = await getActiveMercadoPagoCredentials();
  return !!active.accessToken && !!active.webhookSecret;
}

/** Access token salvo de um ambiente (só servidor — "Testar conexão" com o campo em branco). */
export async function getSavedMercadoPagoAccessToken(env: MercadoPagoEnv): Promise<string | null> {
  return readPair(await loadPlatformSettingsRow(), env).accessToken;
}

async function upsertSingleton(data: Prisma.PlatformSettingsUncheckedUpdateInput, updatedByUserId: string): Promise<MercadoPagoConfigView> {
  const row = await getPrisma().platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data, updatedByUserId } as Prisma.PlatformSettingsUncheckedCreateInput,
    update: { ...data, updatedByUserId },
  });
  return toConfigView(row);
}

/** Campo vazio/ausente = manter o valor atual (mesma regra do resto das Configurações). */
export async function saveMercadoPagoCredentials(
  input: { env: MercadoPagoEnv; publicKey?: string; accessToken?: string; webhookSecret?: string },
  updatedByUserId: string,
): Promise<MercadoPagoConfigView> {
  await loadPlatformSettingsRow(); // migração preguiçosa antes de gravar por cima
  const cols = COLUMNS[input.env];
  const data: Prisma.PlatformSettingsUncheckedUpdateInput = {};
  const publicKey = input.publicKey?.trim();
  const accessToken = input.accessToken?.trim();
  const webhookSecret = input.webhookSecret?.trim();
  if (publicKey) data[cols.publicKey] = publicKey;
  if (accessToken) data[cols.accessToken] = encryptSecret(accessToken);
  if (webhookSecret) data[cols.webhookSecret] = encryptSecret(webhookSecret);
  logger.info("platform.mercadopago.credentials_saved", {
    env: input.env,
    publicKey: !!publicKey,
    accessToken: !!accessToken,
    webhookSecret: !!webhookSecret,
  });
  return upsertSingleton(data, updatedByUserId);
}

export async function removeMercadoPagoSecret(
  input: { env: MercadoPagoEnv; field: MercadoPagoSecretField },
  updatedByUserId: string,
): Promise<MercadoPagoConfigView> {
  await loadPlatformSettingsRow();
  const column = COLUMNS[input.env][input.field];
  logger.info("platform.mercadopago.secret_removed", { env: input.env, field: input.field });
  return upsertSingleton({ [column]: null }, updatedByUserId);
}

export async function setMercadoPagoEnvironment(environment: MercadoPagoEnv, updatedByUserId: string): Promise<MercadoPagoConfigView> {
  await loadPlatformSettingsRow();
  logger.info("platform.mercadopago.environment_changed", { environment });
  return upsertSingleton({ mpEnvironment: environment }, updatedByUserId);
}

export async function setMercadoPagoEnabled(enabled: boolean, updatedByUserId: string): Promise<MercadoPagoConfigView> {
  await loadPlatformSettingsRow();
  logger.info("platform.mercadopago.enabled_changed", { enabled });
  return upsertSingleton({ mpEnabled: enabled }, updatedByUserId);
}
