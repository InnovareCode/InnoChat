import { Layers } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminPlanosPage() {
  return (
    <div>
      <PageHeader title="Planos" description="Limites, preço e ativação de cada plano." />
      <EmptyState icon={Layers} title="Em breve" description="O cadastro de planos ainda está a caminho." />
    </div>
  );
}
