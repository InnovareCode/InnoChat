import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AgendaPage() {
  return (
    <div>
      <PageHeader title="Agenda" description="Dia e semana por profissional." />
      <EmptyState
        icon={Calendar}
        title="Agenda chega na Fase 2"
        description="Serviços, profissionais e horários entram junto (docs/arquitetura.md §13). Por enquanto, esta tela é só um placeholder do shell."
      />
    </div>
  );
}
