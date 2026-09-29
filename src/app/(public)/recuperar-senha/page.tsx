import type { Metadata } from "next";
import { PublicSplitLayout } from "@/components/public/public-split-layout";
import { RecuperarSenhaForm } from "./recuperar-senha-form";

export const metadata: Metadata = { title: "Recuperar senha — InnoChat" };

export default function RecuperarSenhaPage() {
  return (
    <PublicSplitLayout>
      <RecuperarSenhaForm />
    </PublicSplitLayout>
  );
}
