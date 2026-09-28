import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listProfessionalsAction } from "@/modules/agenda/catalog-actions";
import { ProfissionaisClient, type ProfessionalRow } from "./profissionais-client";

export default async function ProfissionaisPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const result = await listProfessionalsAction(tenantSlug);

  if (!result.ok) {
    return (
      <div>
        <PageHeader title="Profissionais" description="Expediente semanal e serviços de cada um." />
        <EmptyState
          icon={UserRound}
          title="Não deu para carregar os profissionais"
          description={result.error.message}
        />
      </div>
    );
  }

  return (
    <ProfissionaisClient tenantSlug={tenantSlug} initialProfessionals={result.data as ProfessionalRow[]} />
  );
}
