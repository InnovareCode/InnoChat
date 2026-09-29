/** Espelho do contrato de `getMercadoPagoConfigAction` (src/modules/platform/actions.ts). Segredos nunca
 * voltam do servidor — só `*Saved`. A Public Key é o único campo devolvido em claro. */
export type MercadoPagoEnv = "PRODUCTION" | "SANDBOX";

export type MercadoPagoEnvCredentials = {
  publicKey: string | null;
  accessTokenSaved: boolean;
  webhookSecretSaved: boolean;
};

export type MercadoPagoConfig = {
  environment: MercadoPagoEnv;
  enabled: boolean;
  production: MercadoPagoEnvCredentials;
  sandbox: MercadoPagoEnvCredentials;
};

export type MercadoPagoSecretField = "accessToken" | "webhookSecret";

export type ConnectionTest = { ok: boolean; detalhe: string };
