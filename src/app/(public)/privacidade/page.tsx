import type { Metadata } from "next";
import { fillLegalIntro, fillLegalSections, LegalDocument } from "@/components/legal/legal-document";
import { getPublicLegalInfo } from "@/modules/platform/legal-service";
import { PRIVACIDADE_INTRO, PRIVACIDADE_SECTIONS } from "./privacidade-content";

export const metadata: Metadata = {
  title: "Política de privacidade — InnoChat",
  description: "Como o InnoChat trata dados pessoais, de acordo com a LGPD.",
};

/** Renderizada a cada requisição: lê os dados jurídicos do banco (Admin → Dados jurídicos), e o
 * build de produção roda SEM banco (docs/deploy-easypanel.md). Com `revalidate` a página era
 * pré-renderizada no build e o deploy quebrava ("DATABASE_URL not found"). */
export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const legalInfo = await getPublicLegalInfo();

  return (
    <LegalDocument
      title="Política de privacidade"
      intro={fillLegalIntro(PRIVACIDADE_INTRO, legalInfo)}
      sections={fillLegalSections(PRIVACIDADE_SECTIONS, legalInfo)}
      related={{ href: "/termos", label: "Termos de uso" }}
    />
  );
}
