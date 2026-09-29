/**
 * Identificação do sistema: qual versão está no ar e quem o desenvolveu.
 *
 * Fonte única: o `version` do `package.json`, injetado em build-time por `next.config.ts`
 * (`env.NEXT_PUBLIC_APP_VERSION` / `NEXT_PUBLIC_BUILD_DATE`). A versão visível não é enfeite: sem
 * ela o suporte não sabe qual build o usuário estava usando. Para publicar nova versão basta
 * mudar o `version` do package.json — o selo e a assinatura de todas as telas acompanham.
 *
 * Os fallbacks só valem fora do `next build` (ex.: vitest sem env); nunca aparecem em produção.
 */
export const NOME_SISTEMA = "InnoChat";

/** Empresa desenvolvedora. */
export const DESENVOLVEDORA = "InnovareCode";
export const DESENVOLVEDORA_URL = "https://innovarecode.com.br";

/** Versão semântica, vinda do package.json. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

/** Data em que o bundle foi compilado (UTC, AAAA-MM-DD). */
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? "0000-00-00";

/** "v1.0.0" — formato usado na interface. */
export const VERSAO_EXIBIDA = `v${APP_VERSION}`;
