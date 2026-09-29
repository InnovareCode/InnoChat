import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { cn } from "@/components/lib/cn";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageLoading
      icon={navIconFor("whatsapp")}
      title="WhatsApp"
      description="Números conectados, QR code e status da conexão."
      action="w-52"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className={cn("flex-col overflow-hidden rounded-hero", i === 0 ? "flex" : "hidden sm:flex")}>
            {/* Celular: mesma caixa reservada do PhoneScale (221x442 no celular, 260x520 a partir de sm). */}
            <div className="flex justify-center px-4 pb-5 pt-6 sm:pt-7">
              <Skeleton className="h-[442px] w-[221px] rounded-[34px] sm:h-[520px] sm:w-[260px]" />
            </div>
            <div className="flex min-h-[214px] flex-1 flex-col gap-3 border-t border-border p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/5" />
              <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
                <Skeleton className="h-11 flex-1" />
                <Skeleton className="h-11 flex-1" />
                <Skeleton className="h-11 w-11" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </PageLoading>
  );
}
