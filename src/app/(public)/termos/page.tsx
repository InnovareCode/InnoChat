import type { Metadata } from "next";
import { fillLegalIntro, fillLegalSections, LegalDocument } from "@/components/legal/legal-document";
import { getPublicLegalInfo } from "@/modules/platform/legal-service";
import { TERMOS_INTRO, TERMOS_SECTIONS } from "./termos-content";

export const metadata: Metadata = {
  title: "Termos de uso — InnoChat",
  description: "Regras de contratação e uso do InnoChat, plataforma de agendamento pelo WhatsApp.",
};

/** Renderizada a cada requisição: lê os dados jurídicos do banco (Admin → Dados jurídicos), e o
 * build de produção roda SEM banco (docs/deploy-easypanel.md). Com `revalidate` a página era
 * pré-renderizada no build e o deploy quebrava ("DATABASE_URL not found"). */
export const dynamic = "force-dynamic";

export default async function TermosPage() {
  const legalInfo = await getPublicLegalInfo();

  return (
    <LegalDocument
      title="Termos de uso"
      intro={fillLegalIntro(TERMOS_INTRO, legalInfo)}
      sections={fillLegalSections(TERMOS_SECTIONS, legalInfo)}
      related={{ href: "/privacidade", label: "Política de privacidade" }}
    />
  );
}
