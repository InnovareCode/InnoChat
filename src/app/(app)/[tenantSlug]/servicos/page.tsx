import { Scissors } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function ServicosPage() {
  return (
    <div>
      <PageHeader
        title="Serviços"
        description="Nome, duração, intervalo, preço e quem realiza."
        action={<Button disabled>Novo serviço</Button>}
      />
      <EmptyState
        icon={Scissors}
        title="Cadastro de serviços chega na Fase 2"
        description="CRUD completo depende do modelo Service (Cronos) e das Server Actions da Vega. Placeholder do shell por enquanto."
      />
    </div>
  );
}
