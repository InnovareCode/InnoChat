import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getPlatformSettingsAction } from "@/modules/platform/actions";
import { AdminConfiguracoesClient } from "./admin-configuracoes-client";

export default async function AdminConfiguracoesPage() {
  const result = await getPlatformSettingsAction();

  if (!result.ok) {
    return (
      <div>
        <PageHeader title="Configurações da plataforma" description="Evolution, e-mail e segredo da API interna." />
        <EmptyState icon={Settings} title="Não deu para carregar" description={result.error.message} />
      </div>
    );
  }

  return <AdminConfiguracoesClient initialSettings={result.data} />;
}
