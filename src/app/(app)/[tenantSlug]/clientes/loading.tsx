import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { CountChipSkeleton, SearchCardSkeleton, TableCardSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("clientes")}
      title="Clientes"
      description="Lista, agendamentos e pausa do bot por cliente."
      action="w-44"
    >
      <CountChipSkeleton />
      <SearchCardSkeleton />
      <TableCardSkeleton columns={4} rows={6} avatarColumn />
    </PageLoading>
  );
}
