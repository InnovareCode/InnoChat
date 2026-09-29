import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { TableCardSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("admin/empresas")}
      title="Empresas"
      description="Status da assinatura, limites e trial de cada empresa."
    >
      <TableCardSkeleton columns={5} rows={6} avatarColumn />
    </PageLoading>
  );
}
