import { getPrisma } from "@/lib/db/prisma";
import { tryGetPublicBaseUrl } from "@/lib/public-url";
import type { EmailContext } from "./layout";

/**
 * Resolve, em runtime, o que o layout precisa para a marca e o rodapé: URL pública (imagens
 * `/marca/*`, `/termos`, `/privacidade`) e razão social/CNPJ da operadora. NUNCA lança — um
 * e-mail sem logo/rodapé jurídico é melhor que um e-mail que não sai.
 */
export async function loadEmailContext(): Promise<EmailContext> {
  try {
    const [baseUrl, legal] = await Promise.all([
      tryGetPublicBaseUrl(),
      getPrisma().platformSettings.findUnique({ where: { id: 1 }, select: { companyLegalName: true, companyCnpj: true } }),
    ]);
    return { baseUrl, legal };
  } catch {
    return {};
  }
}
