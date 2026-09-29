import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { StatGridSkeleton } from "@/components/loading/parts";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading icon={navIconFor("inicio")} size="hero" title="Início" description="O resumo do seu negócio hoje.">
      <StatGridSkeleton count={5} />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[300px] rounded-hero lg:col-span-2" />
        <Skeleton className="h-[300px] rounded-hero" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[60px] rounded-hero" />
        ))}
      </div>
    </PageLoading>
  );
}
