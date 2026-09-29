import { navIconFor } from "@/components/shell/nav-items";
import { PageLoading } from "@/components/loading/page-loading";
import { SectionCardSkeleton } from "@/components/loading/parts";

export default function Loading() {
  return (
    <PageLoading icon={navIconFor("minha-conta")} title="Minha conta" description="Seu nome e o e-mail de acesso.">
      <SectionCardSkeleton bodyHeight="h-40" className="max-w-2xl" withFooter />
    </PageLoading>
  );
}
