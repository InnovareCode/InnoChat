import { Scissors } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listServicesAction } from "@/modules/agenda/catalog-actions";
import { ServicosClient, type ServiceRow } from "./servicos-client";

export default async function ServicosPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const result = await listServicesAction(tenantSlug);

  if (!result.ok) {
    return (
      <div>
        <PageHeader title="Serviços" description="Nome, duração, intervalo, preço opcional e ordem." />
        <EmptyState
          icon={Scissors}
          title="Não deu para carregar os serviços"
          description={result.error.message}
        />
      </div>
    );
  }

  return (
    <ServicosClient tenantSlug={tenantSlug} initialServices={result.data as ServiceRow[]} />
  );
}
