import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("configuracoes")}
      title="Aparência"
      description="O tema escolhido vale para toda a equipe desta empresa."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="rounded-hero p-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="mt-3 h-5 w-1/2" />
            <Skeleton className="mt-2 h-4 w-3/4" />
          </Card>
        ))}
      </div>
    </PageLoading>
  );
}
