import { Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminSaudePage() {
  return (
    <div>
      <PageHeader title="Saúde" description="Instâncias, erros do bot e último billing/tick." />
      <EmptyState icon={Activity} title="Em breve" description="Instâncias, erros do bot e métricas ainda estão a caminho." />
    </div>
  );
}
