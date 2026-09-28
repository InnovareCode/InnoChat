import type { Metadata } from "next";
import { RecuperarSenhaForm } from "./recuperar-senha-form";

export const metadata: Metadata = { title: "Recuperar senha — InnoChat" };

export default function RecuperarSenhaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <RecuperarSenhaForm />
      </div>
    </main>
  );
}
