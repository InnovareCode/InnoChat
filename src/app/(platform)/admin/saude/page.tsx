import { Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { navIconFor } from "@/components/shell/nav-items";
import { EmptyState } from "@/components/ui/empty-state";
import { getPlatformHealthAction } from "@/modules/platform/actions";
import { AdminSaudeClient } from "./admin-saude-client";

export default async function AdminSaudePage() {
  const result = await getPlatformHealthAction();

  if (!result.ok) {
    return (
      <div>
        <PageHeader icon={navIconFor("admin/saude")} title="Saúde" description="Instâncias, integrações e último billing/tick." />
        <EmptyState icon={Activity} title="Não deu para carregar a saúde da plataforma" description={result.error.message} />
      </div>
    );
  }

  return <AdminSaudeClient initialHealth={result.data} />;
}
