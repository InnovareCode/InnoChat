import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatGridSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("admin/saude")}
      title="Saúde"
      description="Integrações, jobs periódicos e volume operacional da plataforma."
      action="w-36"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="flex items-center gap-3.5 rounded-hero p-5">
            <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </Card>
        ))}
      </div>
      <StatGridSkeleton count={4} className="mt-6 lg:grid-cols-4" />
    </PageLoading>
  );
}
