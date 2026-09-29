import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("admin/planos")}
      title="Planos"
      description="Limites, preço e ativação de cada plano."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="flex flex-col gap-3 rounded-hero p-5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-9 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-11 w-full" />
          </Card>
        ))}
      </div>
    </PageLoading>
  );
}
