import type { Metadata } from "next";
import { AuthShell } from "@/components/public/auth-shell";
import { CadastroForm } from "./cadastro-form";

export const metadata: Metadata = { title: "Criar conta — InnoChat" };

export default function CadastroPage() {
  return (
    <AuthShell formMaxWidth="max-w-2xl" topLink={{ prompt: "Já tem conta?", label: "Entrar", href: "/login" }}>
      <CadastroForm />
    </AuthShell>
  );
}
