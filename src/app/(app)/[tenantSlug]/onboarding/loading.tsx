import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { SectionCardSkeleton } from "@/components/loading/parts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("onboarding")}
      title="Primeiros passos"
      description="Configure sua empresa para começar a agendar pelo painel."
    >
      <div className="mb-6 flex items-center gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 flex-1 rounded-full" />
        ))}
      </div>
      <SectionCardSkeleton bodyHeight="h-40" withFooter />
    </PageLoading>
  );
}
