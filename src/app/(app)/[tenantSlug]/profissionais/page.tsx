import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function ProfissionaisPage() {
  return (
    <div>
      <PageHeader
        title="Profissionais"
        description="Expediente semanal e serviços de cada um."
        action={<Button disabled>Novo profissional</Button>}
      />
      <EmptyState
        icon={UserRound}
        title="Cadastro de profissionais chega na Fase 2"
        description="Respeita o limite do plano contratado. Placeholder do shell por enquanto."
      />
    </div>
  );
}
