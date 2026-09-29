import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { SectionCardSkeleton, TableCardSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("configuracoes")}
      title="Bloqueios e feriados"
      description="Períodos em que a empresa inteira não atende."
    >
      <div className="flex flex-col gap-6">
        <SectionCardSkeleton bodyHeight="h-24" withFooter />
        <TableCardSkeleton columns={4} rows={3} mobileRows={3} />
      </div>
    </PageLoading>
  );
}
