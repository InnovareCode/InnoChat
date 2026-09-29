import type { Metadata } from "next";
import Link from "next/link";
import { PublicSplitLayout } from "@/components/public/public-split-layout";
import { CadastroForm } from "./cadastro-form";

export const metadata: Metadata = { title: "Criar conta — InnoChat" };

export default function CadastroPage() {
  return (
    <PublicSplitLayout formMaxWidth="max-w-md">
      <CadastroForm />
      <p className="mt-4 text-center text-sm text-text-secondary">
        Já tem conta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </PublicSplitLayout>
  );
}
