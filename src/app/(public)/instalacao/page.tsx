import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasPlatformAdmin } from "@/modules/platform/install";
import { PublicSplitLayout } from "@/components/public/public-split-layout";
import { InstalacaoForm } from "./instalacao-form";

export const metadata: Metadata = { title: "Instalação — InnoChat" };

// Sem isto, o Next prerenderia esta página como estática NO BUILD (sem admin ainda) e serviria
// esse HTML congelado para sempre em produção — o `hasPlatformAdmin()` abaixo nunca rodaria de
// novo depois do deploy, e a página nunca viraria 404 mesmo após a instalação (docs/contratos.md:
// "responde 404 depois"). Força reavaliação a cada requisição.
export const dynamic = "force-dynamic";

/**
 * Bootstrap do primeiro admin da plataforma (docs/contratos.md). Só existe enquanto NÃO houver
 * nenhum `User.isPlatformAdmin` — depois da instalação, responde 404 (nunca redireciona: um
 * 404 não revela se a instalação já rodou por outro caminho que não seja "não achei nada
 * aqui", igual a qualquer outra rota que deixou de existir).
 */
export default async function InstalacaoPage() {
  if (await hasPlatformAdmin()) {
    notFound();
  }

  return (
    <PublicSplitLayout formMaxWidth="max-w-md">
      <InstalacaoForm />
    </PublicSplitLayout>
  );
}
