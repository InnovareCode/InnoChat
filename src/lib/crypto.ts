/**
 * Criptografia simétrica para segredos da plataforma em repouso (Access Token / Webhook Secret do
 * Mercado Pago, chave da Evolution, chave da API do n8n, senha SMTP — todos em `PlatformSettings`).
 *
 * Mesmo formato do Parque das Feiras (`backend/src/lib/crypto.ts`): AES-256-GCM (cifra autenticada
 * — detecta adulteração do dado, não só chave errada), payload base64 de
 * `iv (12 bytes) | tag (16 bytes) | ciphertext`. Diferença: o valor persistido leva o prefixo de
 * versão `enc:v1:`, que permite distinguir um segredo cifrado de um valor legado em texto puro
 * (migração preguiçosa, `src/modules/platform/secrets.ts`) e trocar o algoritmo no futuro (`v2`).
 *
 * CHAVE: derivada do `AUTH_SECRET` via scrypt com salt fixo próprio do InnoChat (decisão do dono,
 * 2026-09-29: só 2 variáveis de ambiente — `DATABASE_URL` e `AUTH_SECRET`). CONSEQUÊNCIA
 * OPERACIONAL: trocar o `AUTH_SECRET` faz todos os segredos já salvos deixarem de decifrar —
 * eles passam a valer como AUSENTES (fail-closed) e precisam ser recadastrados em
 * Admin > Configurações. Ver docs/runbook.md.
 *
 * FAIL-CLOSED: `decryptSecret` nunca lança — chave errada, dado adulterado ou formato inválido
 * devolvem `null`, e o resto do sistema já trata `null` como "não configurado" (Pix não é gerado,
 * webhook é rejeitado). Nunca logue o valor em claro nem o payload cifrado.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export const ENCRYPTED_PREFIX = "enc:v1:";

const IV_LENGTH = 12; // recomendado pelo NIST para GCM
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // AES-256
const MIN_AUTH_SECRET_LENGTH = 16; // mesmo mínimo de `src/env.ts`

/**
 * Salt fixo, só para esticar o `AUTH_SECRET` em material de chave. Não precisa ser secreto — a
 * segurança depende do `AUTH_SECRET`. NÃO ALTERE: invalida todo segredo já cifrado.
 */
const KEY_SALT = "innochat:lib/crypto:aes-256-gcm:v1";

// scryptSync é intencionalmente caro (~100ms): deriva uma vez por valor de AUTH_SECRET. A chave do
// cache é o próprio secret, então um teste que troque `process.env.AUTH_SECRET` não precisa de reset.
let cached: { secret: string; key: Buffer } | null = null;

function getKey(): Buffer | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_AUTH_SECRET_LENGTH) return null;
  if (!cached || cached.secret !== secret) {
    cached = { secret, key: scryptSync(secret, KEY_SALT, KEY_LENGTH) };
  }
  return cached.key;
}

/** Já está no formato cifrado do InnoChat (`enc:v1:...`)? Não diz se DECIFRA — só o formato. */
export function isEncryptedSecret(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Cifra um texto e devolve `enc:v1:<base64>` pronto para salvar. Lança se não houver
 * `AUTH_SECRET` utilizável — gravar segredo sem conseguir cifrar seria pior que falhar.
 */
export function encryptSecret(plain: string): string {
  const key = getKey();
  if (!key) {
    throw new Error("Não é possível cifrar segredos: AUTH_SECRET ausente ou com menos de 16 caracteres.");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENCRYPTED_PREFIX + Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * Decifra um valor gerado por `encryptSecret`. FAIL-CLOSED: devolve `null` (nunca lança) se o
 * valor não tem o prefixo, se o `AUTH_SECRET` mudou, se o dado foi adulterado ou está truncado.
 */
export function decryptSecret(stored: string): string | null {
  if (!isEncryptedSecret(stored)) return null;
  const key = getKey();
  if (!key) return null;

  const buf = Buffer.from(stored.slice(ENCRYPTED_PREFIX.length), "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH) return null;

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
