import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AgendamentosPage() {
  return (
    <div>
      <PageHeader title="Agendamentos" description="Lista com filtros — útil no celular." />
      <EmptyState
        icon={ClipboardList}
        title="Lista chega na Fase 2"
        description="Depende do modelo de Appointment (Cronos/Vega). Placeholder do shell por enquanto."
      />
    </div>
  );
}
