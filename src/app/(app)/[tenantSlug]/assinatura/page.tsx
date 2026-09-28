import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AssinaturaPage() {
  return (
    <div>
      <PageHeader title="Assinatura" description="Plano atual, fatura em aberto e histórico." />
      <EmptyState
        icon={CreditCard}
        title="Cobrança chega na Fase 7"
        description="Depende de Plan/Subscription/Invoice e do Mercado Pago (docs/arquitetura.md §7). Placeholder do shell por enquanto."
      />
    </div>
  );
}
