import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("mensagens-bot")}
      title="Mensagens do bot"
      description="Edite os textos que o bot envia no WhatsApp, por etapa da conversa."
    >
      <div className="flex flex-col gap-6">
        {[3, 3, 2].map((rows, g) => (
          <Card key={g} className="rounded-hero">
            <div className="border-b border-border p-5">
              <Skeleton className="h-6 w-44" />
            </div>
            <div className="flex flex-col divide-y divide-border">
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <Skeleton className="h-11 w-20" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </PageLoading>
  );
}
