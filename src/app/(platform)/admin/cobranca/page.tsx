import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminCobrancaPage() {
  return (
    <div>
      <PageHeader title="Cobrança" description="Faturas abertas, vencidas e eventos do Mercado Pago." />
      <EmptyState icon={Receipt} title="Cobrança chega na Fase 7" description="Depende de Invoice e ProviderEvent." />
    </div>
  );
}
