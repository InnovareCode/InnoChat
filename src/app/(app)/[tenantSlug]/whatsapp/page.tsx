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
        title="Em breve"
        description="A conexão com o WhatsApp (QR code e status) ainda está a caminho."
      />
    </div>
  );
}
