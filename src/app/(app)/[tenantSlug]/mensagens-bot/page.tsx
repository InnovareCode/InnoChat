import { Bot } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

export default function MensagensBotPage() {
  return (
    <div>
      <PageHeader title="Mensagens do bot" description="Edite os textos que o bot envia no WhatsApp." />
      <EmptyState
        icon={Bot}
        title="Em breve"
        description="A edição dos textos do bot ainda está a caminho."
      />
    </div>
  );
}
