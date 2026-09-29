import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PublicSplitLayout } from "@/components/public/public-split-layout";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar — InnoChat" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; redefinida?: string; instalado?: string }>;
}) {
  const { erro, redefinida, instalado } = await searchParams;

  return (
    <PublicSplitLayout>
      <Card className="rounded-hero">
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
          {instalado === "1" ? (
            <Alert variant="success" title="Instalação concluída">
              A conta de administrador da plataforma foi criada. Entre com o e-mail e a senha que você definiu.
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
    </PublicSplitLayout>
  );
}
