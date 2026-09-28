import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminCobrancaPage() {
  return (
    <div>
      <PageHeader title="Cobrança" description="Faturas abertas, vencidas e eventos do Mercado Pago." />
      <EmptyState icon={Receipt} title="Em breve" description="Faturas e eventos de cobrança ainda estão a caminho." />
    </div>
  );
}
