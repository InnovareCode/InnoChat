import { Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminSaudePage() {
  return (
    <div>
      <PageHeader title="Saúde" description="Instâncias, erros do bot e último billing/tick." />
      <EmptyState icon={Activity} title="Tela chega na Fase 8" description="Depende de InboundEvent e métricas do n8n." />
    </div>
  );
}
