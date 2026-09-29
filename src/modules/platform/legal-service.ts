import { cache } from "react";
import { getPrisma } from "@/lib/db/prisma";
import type { PlatformLegalInfo } from "@/core/legal/placeholders";

/**
 * Dados jurídicos da empresa OPERADORA do InnoChat (Innovare Code) — docs/contratos.md, "Dados
 * jurídicos". Vivem em `PlatformSettings` (mesmo singleton `id = 1` de sempre) mas em um módulo
 * PRÓPRIO, separado de `service.ts` (credenciais de integração, sempre mascaradas): nenhum campo
 * aqui é segredo, então a leitura devolve tudo em claro — misturar os dois na mesma
 * `PlatformSettingsView` arriscaria alguém aplicar a régua de mascaramento errada por engano.
 */

const LEGAL_SELECT = {
  companyLegalName: true,
  companyCnpj: true,
  companyAddress: true,
  contactEmail: true,
  dpoName: true,
  dpoEmail: true,
  forumCity: true,
  hostingRegion: true,
  backupRetentionDays: true,
} as const;

function emptyLegalInfo(): PlatformLegalInfo {
  return {
    companyLegalName: null,
    companyCnpj: null,
    companyAddress: null,
    contactEmail: null,
    dpoName: null,
    dpoEmail: null,
    forumCity: null,
    hostingRegion: null,
    backupRetentionDays: null,
  };
}

/** Leitura para a tela de admin "Dados jurídicos" — nenhum campo é segredo, tudo em claro. */
export async function getPlatformLegalInfo(): Promise<PlatformLegalInfo> {
  const row = await getPrisma().platformSettings.findUnique({ where: { id: 1 }, select: LEGAL_SELECT });
  return row ?? emptyLegalInfo();
}

export type PlatformLegalInfoInput = Partial<PlatformLegalInfo>;

/**
 * Grava os dados jurídicos. Diferente de `updatePlatformSettings` (service.ts, credenciais),
 * aqui não há regra de "string vazia mantém o valor atual" — string vazia ou `null` LIMPA o
 * campo (o admin pode querer remover um dado errado sem ter que digitar outra coisa por cima).
 * `undefined` (campo não enviado no `input`) mantém o valor atual.
 */
export async function updatePlatformLegalInfo(input: PlatformLegalInfoInput, updatedByUserId: string): Promise<PlatformLegalInfo> {
  const data: Record<string, unknown> = { updatedByUserId };
  for (const key of Object.keys(LEGAL_SELECT) as (keyof PlatformLegalInfo)[]) {
    if (key in input) {
      const value = input[key];
      data[key] = typeof value === "string" ? value.trim() || null : value ?? null;
    }
  }

  const row = await getPrisma().platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
    select: LEGAL_SELECT,
  });
  return row;
}

/**
 * Leitura PÚBLICA (sem `requirePlatformAdmin`) para as páginas `/termos` e `/privacidade`
 * preencherem os marcadores `[CNPJ]`/`[ENDEREÇO]`/etc. via `fillLegalPlaceholders`
 * (`src/core/legal/placeholders.ts`). `cache()` do React deduplica dentro do MESMO ciclo de
 * render de uma requisição (várias seções da página podem chamar isto sem re-consultar o banco
 * mais de uma vez) — não é um cache entre requisições distintas, nem precisa ser: é uma leitura
 * de banco local, não uma chamada de rede externa.
 */
export const getPublicLegalInfo = cache(async (): Promise<PlatformLegalInfo> => {
  return getPlatformLegalInfo();
});
