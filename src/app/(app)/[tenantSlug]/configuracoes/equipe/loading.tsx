import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { SectionCardSkeleton, TableCardSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("configuracoes")}
      title="Equipe"
      description="Quem tem acesso ao painel desta empresa."
    >
      <div className="flex flex-col gap-6">
        <TableCardSkeleton columns={3} rows={3} mobileRows={3} avatarColumn />
        <SectionCardSkeleton bodyHeight="h-16" withFooter />
      </div>
    </PageLoading>
  );
}
