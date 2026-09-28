import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function WhatsappPage() {
  return (
    <div>
      <PageHeader
        title="WhatsApp"
        description="Números conectados, QR e status da conexão."
        action={<Button disabled>Conectar número</Button>}
      />
      <EmptyState
        icon={MessageCircle}
        title="Conexão com a Evolution chega na Fase 3"
        description="QR code, status e limite de números por plano (docs/arquitetura.md §4). Placeholder do shell por enquanto."
      />
    </div>
  );
}
