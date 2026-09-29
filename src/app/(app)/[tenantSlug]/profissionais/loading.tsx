import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { TableCardSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("profissionais")}
      title="Profissionais"
      description="Expediente semanal e serviços de cada um."
      action="w-48"
    >
      <TableCardSkeleton columns={4} rows={5} avatarColumn />
    </PageLoading>
  );
}
