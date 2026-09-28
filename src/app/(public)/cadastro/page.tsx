import type { Metadata } from "next";
import Link from "next/link";
import { CadastroForm } from "./cadastro-form";

export const metadata: Metadata = { title: "Criar conta — InnoChat" };

export default function CadastroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="font-display text-lg font-bold text-text">InnoChat</span>
        </div>
        <CadastroForm />
        <p className="mt-4 text-center text-sm text-text-secondary">
          Já tem conta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
