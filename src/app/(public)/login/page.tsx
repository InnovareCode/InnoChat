import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar — InnoChat" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; redefinida?: string }>;
}) {
  const { erro, redefinida } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="font-display text-lg font-bold text-text">InnoChat</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
            <CardDescription>Acesse o painel da sua empresa.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {erro === "sem-empresa" ? (
              <Alert variant="warning" title="Sem empresa vinculada">
                Sua conta ainda não está ligada a nenhuma empresa no InnoChat.
              </Alert>
            ) : null}
            {redefinida === "1" ? (
              <Alert variant="success" title="Senha redefinida">
                Já pode entrar com a nova senha.
              </Alert>
            ) : null}
            <LoginForm />
            <p className="text-center text-sm text-text-secondary">
              <Link href="/recuperar-senha" className="text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </p>
            <p className="text-center text-sm text-text-secondary">
              Ainda não tem conta?{" "}
              <Link href="/cadastro" className="text-primary hover:underline">
                Criar conta
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
