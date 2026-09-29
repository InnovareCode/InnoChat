import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { SectionCardSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading icon={navIconFor("profissionais")} title="Profissional" description="Expediente semanal e serviços.">
      <div className="flex flex-col gap-6">
        <SectionCardSkeleton bodyHeight="h-40" withFooter />
        <SectionCardSkeleton bodyHeight="h-56" withFooter />
        <SectionCardSkeleton bodyHeight="h-24" withFooter />
      </div>
    </PageLoading>
  );
}
