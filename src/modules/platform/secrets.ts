import type { PlatformSettings } from "@/lib/db/types";
import { getPrisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";

/**
 * Segredos da plataforma em repouso (`PlatformSettings`), cifrados com `src/lib/crypto.ts`.
 *
 * MIGRAÇÃO PREGUIÇOSA (o SQL da migration não conhece a chave, que deriva do `AUTH_SECRET`):
 * até 2026-09-29 `evolutionApiKey`, `n8nApiKey`, `smtpPassword`, `mercadoPagoAccessToken` e
 * `mercadoPagoWebhookSecret` eram texto puro. Toda leitura passa por `loadPlatformSettingsRow()`,
 * que na primeira vez em que encontra um valor legado o cifra e grava de volta:
 *  - os três primeiros continuam nas mesmas colunas, agora `enc:v1:...`;
 *  - o par legado do Mercado Pago vai, cifrado, para o par de PRODUÇÃO (`mpProd*Enc`) e as colunas
 *    antigas são zeradas.
 * A gravação é condicional ao valor lido (compare-and-set): duas requisições concorrentes não se
 * atropelam, quem perde só relê a linha já migrada.
 *
 * FAIL-CLOSED: segredo que não decifra (AUTH_SECRET trocado, dado corrompido) é tratado como
 * AUSENTE (`null`) — nunca como texto puro.
 */

const GENERIC_SECRET_FIELDS = ["evolutionApiKey", "n8nApiKey", "smtpPassword"] as const;
export type GenericSecretField = (typeof GENERIC_SECRET_FIELDS)[number];

/**
 * Lê um valor persistido nas colunas genéricas: `enc:v1:` decifra (falha => `null`); qualquer outro
 * texto é LEGADO em claro (aceito até a migração preguiçosa gravar cifrado).
 */
export function readGenericSecret(stored: string | null | undefined, field: string): string | null {
  if (!stored) return null;
  if (!isEncryptedSecret(stored)) return stored;
  return readEncryptedSecret(stored, field);
}

/** Lê uma coluna `*Enc` (só aceita o formato cifrado; texto puro numa coluna `Enc` vale como ausente). */
export function readEncryptedSecret(stored: string | null | undefined, field: string): string | null {
  if (!stored) return null;
  const value = decryptSecret(stored);
  if (value === null) {
    // Só o NOME do campo — nunca o valor cifrado nem o em claro.
    logger.warn("platform.secret.undecryptable", { field });
    return null;
  }
  return value;
}

type MigrationField = GenericSecretField | "mercadoPagoAccessToken" | "mercadoPagoWebhookSecret" | "mpProdAccessTokenEnc" | "mpProdWebhookSecretEnc";
type MigrationPatch = Partial<Record<MigrationField, string | null>>;

function migrationPatch(row: PlatformSettings): MigrationPatch {
  const patch: MigrationPatch = {};

  for (const field of GENERIC_SECRET_FIELDS) {
    const stored = row[field];
    if (stored && !isEncryptedSecret(stored)) patch[field] = encryptSecret(stored);
  }

  // Par legado do MP -> par de PRODUÇÃO cifrado. Se o par de produção já tem valor (o admin já
  // gravou pela tela nova), o legado é uma cópia velha: só é descartado, nunca sobrescreve.
  if (row.mercadoPagoAccessToken) {
    if (!row.mpProdAccessTokenEnc) patch.mpProdAccessTokenEnc = encryptSecret(row.mercadoPagoAccessToken);
    patch.mercadoPagoAccessToken = null;
  }
  if (row.mercadoPagoWebhookSecret) {
    if (!row.mpProdWebhookSecretEnc) patch.mpProdWebhookSecretEnc = encryptSecret(row.mercadoPagoWebhookSecret);
    patch.mercadoPagoWebhookSecret = null;
  }
  return patch;
}

/**
 * Lê `PlatformSettings` (id 1) já com a migração preguiçosa aplicada. Devolve `null` se a linha
 * ainda não existe. Único caminho de leitura da linha com segredos — nenhum outro código deve
 * fazer `findUnique` direto pedindo colunas de segredo.
 */
export async function loadPlatformSettingsRow(): Promise<PlatformSettings | null> {
  const prisma = getPrisma();
  const row = await prisma.platformSettings.findUnique({ where: { id: 1 } });
  if (!row) return null;

  let patch: MigrationPatch;
  try {
    patch = migrationPatch(row);
  } catch (error) {
    // Sem AUTH_SECRET utilizável não dá para cifrar: segue lendo o legado, tenta de novo depois.
    logger.error("platform.secret.migration_skipped", { errorMessage: error instanceof Error ? error.message : String(error) });
    return row;
  }
  if (Object.keys(patch).length === 0) return row;

  // Compare-and-set: só grava se as colunas legadas ainda têm o valor que lemos.
  const guard: Partial<Record<MigrationField, string | null>> = {};
  for (const key of Object.keys(patch) as MigrationField[]) {
    if (key.startsWith("mp")) continue; // colunas novas: o guard fica nas legadas correspondentes
    guard[key] = row[key];
  }
  if (patch.mpProdAccessTokenEnc !== undefined) guard.mpProdAccessTokenEnc = null;
  if (patch.mpProdWebhookSecretEnc !== undefined) guard.mpProdWebhookSecretEnc = null;

  const { count } = await prisma.platformSettings.updateMany({ where: { id: 1, ...guard }, data: patch });
  logger.info("platform.secret.legacy_migrated", { fields: Object.keys(patch), applied: count === 1 });
  if (count === 1) return { ...row, ...patch };
  return (await prisma.platformSettings.findUnique({ where: { id: 1 } })) ?? row;
}

/** Segredos genéricos em claro — SÓ para uso no servidor (nunca devolver ao client). */
export async function getPlatformSecrets(): Promise<Record<GenericSecretField, string | null>> {
  const row = await loadPlatformSettingsRow();
  return {
    evolutionApiKey: readGenericSecret(row?.evolutionApiKey, "evolutionApiKey"),
    n8nApiKey: readGenericSecret(row?.n8nApiKey, "n8nApiKey"),
    smtpPassword: readGenericSecret(row?.smtpPassword, "smtpPassword"),
  };
}
