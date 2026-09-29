import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { TableCardSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("servicos")}
      title="Serviços"
      description="Nome, duração, intervalo, preço opcional e ordem."
      action="w-40"
    >
      <TableCardSkeleton columns={6} rows={5} />
    </PageLoading>
  );
}
