import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { listPlansAction } from "@/modules/billing/admin-actions";
import { AdminPlanosClient, type PlanRow } from "./admin-planos-client";

export default async function AdminPlanosPage() {
  const result = await listPlansAction();

  if (!result.ok) {
    return (
      <div>
        <PageHeader title="Planos" description="Limites, preço e ativação de cada plano." />
        <EmptyState icon={Layers} title="Não deu para carregar os planos" description={result.error.message} />
      </div>
    );
  }

  return <AdminPlanosClient initialPlans={result.data as PlanRow[]} />;
}
