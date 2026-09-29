import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { SectionCardSkeleton } from "@/components/loading/parts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("assinatura")}
      title="Assinatura"
      description="Plano atual, status e fatura em aberto."
    >
      <div className="flex flex-col gap-6">
        <SectionCardSkeleton bodyHeight="h-14" withFooter />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-hero" />
          ))}
        </div>
      </div>
    </PageLoading>
  );
}
