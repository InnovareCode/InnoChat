import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientesPage() {
  return (
    <div>
      <PageHeader title="Clientes" description="Lista, agendamentos e pausa do bot por cliente." />
      <EmptyState
        icon={Users}
        title="Em breve"
        description="A lista de clientes e o histórico de atendimentos ainda estão a caminho."
      />
    </div>
  );
}
