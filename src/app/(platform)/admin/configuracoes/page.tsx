import { Settings } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminConfiguracoesPage() {
  return (
    <div>
      <PageHeader
        title="Configurações da plataforma"
        description="Evolution, n8n, Mercado Pago, e-mail — sempre mascarado."
      />
      <EmptyState
        icon={Settings}
        title="Tela chega na Fase 1 (Vega)"
        description="Depende de PlatformSettings e da Server Action updatePlatformSettingsAction (docs/contratos.md). Placeholder do shell por enquanto."
      />
    </div>
  );
}
