import { Bot } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function MensagensBotPage() {
  return (
    <div>
      <PageHeader title="Mensagens do bot" description="Edite os textos que o bot envia no WhatsApp." />
      <EmptyState
        icon={Bot}
        title="Edição de textos chega na Fase 4"
        description="Depende do modelo BotText e da API interna do bot (docs/arquitetura.md §6.7). Placeholder do shell por enquanto."
      />
    </div>
  );
}
