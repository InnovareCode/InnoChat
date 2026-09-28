/**
 * Nome de instância da Evolution (docs/arquitetura.md §4): `innochat-<tenantSlug≤20>-<curto>`,
 * imutável. O prefixo `innochat-` é obrigatório — a Evolution é compartilhada com o
 * InnoAtendente, então dois produtos criando instâncias sem prefixo colidiriam de nome.
 *
 * Função pura: recebe o sufixo aleatório já gerado pelo chamador (I/O de aleatoriedade fica na
 * camada de serviço, `src/modules/whatsapp/service.ts`) para ser testável sem mockar `crypto`.
 */

const MAX_SLUG_SEGMENT = 20;

/** A Evolution (Baileys) só aceita `instanceName` compatível com identificador simples. */
function sanitizeSlugSegment(tenantSlug: string): string {
  return tenantSlug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, MAX_SLUG_SEGMENT)
    .replace(/-+$/g, "");
}

export function buildInstanceName(tenantSlug: string, randomSuffix: string): string {
  const slugSegment = sanitizeSlugSegment(tenantSlug) || "tenant";
  const suffix = randomSuffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "0000";
  return `innochat-${slugSegment}-${suffix}`;
}
