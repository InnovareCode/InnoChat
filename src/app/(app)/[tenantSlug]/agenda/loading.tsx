import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { CountChipSkeleton } from "@/components/loading/parts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading icon={navIconFor("agenda")} title="Agenda" description={<span aria-hidden="true" className="skeleton-shimmer block h-5 w-36 rounded-card" />} action="w-48">
      <CountChipSkeleton />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-11" />
          <Skeleton className="h-11 w-16" />
          <Skeleton className="h-11 w-11" />
          <Skeleton className="ml-2 h-5 w-44" />
        </div>
        <Skeleton className="h-[54px] w-40" />
      </div>
      <Card className="hidden overflow-hidden rounded-hero p-4 md:block">
        <div className="flex gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[560px] flex-1" />
          ))}
        </div>
      </Card>
      <div className="flex flex-col gap-4 md:hidden">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] rounded-hero" />
        ))}
      </div>
    </PageLoading>
  );
}
