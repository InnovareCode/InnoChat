/**
 * Substituição pura dos marcadores jurídicos usados em `/termos` e `/privacidade`
 * (`src/app/(public)/termos/termos-content.ts`, `.../privacidade/privacidade-content.ts`) pelos
 * dados reais da empresa operadora, cadastrados pelo admin (docs/contratos.md, "Dados
 * jurídicos"). Puro — sem I/O — para poder ser testado sem banco e para a Lyra plugar direto
 * no render das páginas públicas.
 *
 * Os marcadores hoje existentes no texto (conferidos contra os dois arquivos-fonte em
 * 2026-09-29): `[CNPJ]`, `[ENDEREÇO]`, `[E-MAIL DE CONTATO]`, `[E-MAIL DO ENCARREGADO/DPO]`,
 * `[NOME DO ENCARREGADO]`, `[COMARCA]`, `[PAÍS/REGIÃO DO PROVEDOR DE HOSPEDAGEM]`,
 * `[PRAZO DE RETENÇÃO DOS BACKUPS]`. Um marcador sem dado cadastrado é substituído por
 * "a definir" — nunca deixado com o colchete literal (pareceria um bug de template na página
 * pública) e nunca escondido silenciosamente (o texto continua sinalizando que falta preencher).
 */

export type PlatformLegalInfo = {
  companyLegalName: string | null;
  companyCnpj: string | null;
  companyAddress: string | null;
  contactEmail: string | null;
  dpoName: string | null;
  dpoEmail: string | null;
  forumCity: string | null;
  hostingRegion: string | null;
  backupRetentionDays: number | null;
};

const UNDEFINED_PLACEHOLDER = "a definir";

/** `52998224725` → `52.998.224/725`... na verdade formata CNPJ (14 dígitos) como `00.000.000/0000-00`. */
export function formatCnpjDisplay(digitsOrRaw: string): string {
  const digits = digitsOrRaw.replace(/\D/g, "");
  if (digits.length !== 14) return digitsOrRaw;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/** Mapa marcador → valor resolvido (ou `UNDEFINED_PLACEHOLDER`) — mantém `fillLegalPlaceholders` simples de auditar. */
function resolvePlaceholderValues(info: PlatformLegalInfo): Record<string, string> {
  return {
    "[CNPJ]": info.companyCnpj ? formatCnpjDisplay(info.companyCnpj) : UNDEFINED_PLACEHOLDER,
    "[ENDEREÇO]": info.companyAddress?.trim() || UNDEFINED_PLACEHOLDER,
    "[E-MAIL DE CONTATO]": info.contactEmail?.trim() || UNDEFINED_PLACEHOLDER,
    "[E-MAIL DO ENCARREGADO/DPO]": info.dpoEmail?.trim() || UNDEFINED_PLACEHOLDER,
    "[NOME DO ENCARREGADO]": info.dpoName?.trim() || UNDEFINED_PLACEHOLDER,
    "[COMARCA]": info.forumCity?.trim() || UNDEFINED_PLACEHOLDER,
    "[PAÍS/REGIÃO DO PROVEDOR DE HOSPEDAGEM]": info.hostingRegion?.trim() || UNDEFINED_PLACEHOLDER,
    "[PRAZO DE RETENÇÃO DOS BACKUPS]":
      info.backupRetentionDays != null ? `${info.backupRetentionDays} dias` : UNDEFINED_PLACEHOLDER,
  };
}

/**
 * Substitui cada marcador `[...]` conhecido em `text` pelo valor cadastrado em `info`, ou por
 * "a definir" quando vazio. Marcadores desconhecidos (não estão no mapa acima) são deixados como
 * estão — evita mascarar um marcador novo introduzido no texto que ainda não tem campo
 * correspondente aqui (melhor aparecer visível do que sumir silenciosamente).
 */
export function fillLegalPlaceholders(text: string, info: PlatformLegalInfo): string {
  const values = resolvePlaceholderValues(info);
  return text.replace(/\[[^\]]+\]/g, (match) => (match in values ? values[match] : match));
}
