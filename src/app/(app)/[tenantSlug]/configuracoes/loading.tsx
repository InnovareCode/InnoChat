import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { SectionCardSkeleton } from "@/components/loading/parts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("configuracoes")}
      title="Configurações"
      description="Empresa, regras de agenda e do bot, equipe."
    >
      <div className="flex flex-col gap-6">
        <SectionCardSkeleton bodyHeight="h-20" withFooter />
        <SectionCardSkeleton bodyHeight="h-40" withFooter />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="flex items-start gap-3.5 rounded-hero p-5">
              <Skeleton className="h-11 w-11 shrink-0 rounded-card" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PageLoading>
  );
}
