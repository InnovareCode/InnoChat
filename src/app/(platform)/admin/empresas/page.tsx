import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminEmpresasPage() {
  return (
    <div>
      <PageHeader title="Empresas" description="Status da assinatura, limites e trial de cada empresa." />
      <EmptyState
        icon={Building2}
        title="Lista de empresas chega na Fase 7"
        description="Depende de Subscription (Cronos/Vega). Placeholder do shell por enquanto."
      />
    </div>
  );
}
