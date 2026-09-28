import { Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientesPage() {
  return (
    <div>
      <PageHeader title="Clientes" description="Lista, agendamentos e pausa do bot por cliente." />
      <EmptyState
        icon={Users}
        title="Lista de clientes chega na Fase 8"
        description="Depende do modelo Contact e da tela de Atendimentos (docs/arquitetura.md §9). Placeholder do shell por enquanto."
      />
    </div>
  );
}
