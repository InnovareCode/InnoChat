import type { Metadata } from "next";
import { fillLegalIntro, fillLegalSections, LegalDocument } from "@/components/legal/legal-document";
import { getPublicLegalInfo } from "@/modules/platform/legal-service";
import { PRIVACIDADE_INTRO, PRIVACIDADE_SECTIONS } from "./privacidade-content";

export const metadata: Metadata = {
  title: "Política de privacidade — InnoChat",
  description: "Como o InnoChat trata dados pessoais, de acordo com a LGPD.",
};

/** Revalida a cada 60s — ver comentário equivalente em `../termos/page.tsx`. */
export const revalidate = 60;

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
