import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { PRIVACIDADE_INTRO, PRIVACIDADE_SECTIONS } from "./privacidade-content";

export const metadata: Metadata = {
  title: "Política de privacidade — InnoChat",
  description: "Como o InnoChat trata dados pessoais, de acordo com a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <LegalDocument
      title="Política de privacidade"
      intro={PRIVACIDADE_INTRO}
      sections={PRIVACIDADE_SECTIONS}
      related={{ href: "/termos", label: "Termos de uso" }}
    />
  );
}
