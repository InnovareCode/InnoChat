import type { Metadata } from "next";
import { fillLegalIntro, fillLegalSections, LegalDocument } from "@/components/legal/legal-document";
import { getPublicLegalInfo } from "@/modules/platform/legal-service";
import { TERMOS_INTRO, TERMOS_SECTIONS } from "./termos-content";

export const metadata: Metadata = {
  title: "Termos de uso — InnoChat",
  description: "Regras de contratação e uso do InnoChat, plataforma de agendamento pelo WhatsApp.",
};

/** Revalida a cada 60s (mesma janela do cache de integrações em `health-service.ts`) — sem isso
 * o Next otimizaria esta página para estática no build e uma edição em "Dados jurídicos" só
 * apareceria aqui no próximo deploy, não no próximo request. */
export const revalidate = 60;

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
