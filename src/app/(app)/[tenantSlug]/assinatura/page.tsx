import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AssinaturaPage() {
  return (
    <div>
      <PageHeader title="Assinatura" description="Plano atual, fatura em aberto e histórico." />
      <EmptyState
        icon={CreditCard}
        title="Em breve"
        description="Plano atual, faturas e histórico de cobrança ainda estão a caminho."
      />
    </div>
  );
}
