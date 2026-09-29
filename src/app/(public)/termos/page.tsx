import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { TERMOS_INTRO, TERMOS_SECTIONS } from "./termos-content";

export const metadata: Metadata = {
  title: "Termos de uso — InnoChat",
  description: "Regras de contratação e uso do InnoChat, plataforma de agendamento pelo WhatsApp.",
};

export default function TermosPage() {
  return (
    <LegalDocument
      title="Termos de uso"
      intro={TERMOS_INTRO}
      sections={TERMOS_SECTIONS}
      related={{ href: "/privacidade", label: "Política de privacidade" }}
    />
  );
}
