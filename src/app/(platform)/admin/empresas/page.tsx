import { Building2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminEmpresasPage() {
  return (
    <div>
      <PageHeader title="Empresas" description="Status da assinatura, limites e trial de cada empresa." />
      <EmptyState
        icon={Building2}
        title="Em breve"
        description="A lista de empresas com status de assinatura e limites ainda está a caminho."
      />
    </div>
  );
}
