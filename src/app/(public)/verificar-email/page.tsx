import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicSplitLayout } from "@/components/public/public-split-layout";
import { verifyEmailAction } from "@/modules/signup/actions";

export const metadata: Metadata = { title: "Confirmar e-mail — InnoChat" };

export default async function VerificarEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <PublicSplitLayout>
        <Card className="rounded-hero">
          <CardHeader>
            <CardTitle>Link incompleto</CardTitle>
            <CardDescription>Este link de confirmação está sem o código necessário.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">Ir para o login</Link>
            </Button>
          </CardContent>
        </Card>
      </PublicSplitLayout>
    );
  }

  const result = await verifyEmailAction({ token });

  return (
    <PublicSplitLayout>
      <Card className="rounded-hero">
        <CardHeader>
          <div
            className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
              result.ok ? "bg-success-bg" : "bg-danger-bg"
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
            ) : (
              <XCircle className="h-5 w-5 text-danger" aria-hidden="true" />
            )}
          </div>
          <CardTitle>{result.ok ? "E-mail confirmado!" : "Não foi possível confirmar"}</CardTitle>
          <CardDescription>
            {result.ok
              ? "Sua conta já está pronta para uso."
              : "Este link é inválido, já foi usado ou expirou. Peça um novo pelo login."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={result.ok && result.data.tenantSlug ? `/${result.data.tenantSlug}/inicio` : "/login"}>
              {result.ok ? "Ir para o painel" : "Ir para o login"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </PublicSplitLayout>
  );
}
