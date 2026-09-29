import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/lib/cn";
import { InnoWaitHint } from "./inno-wait-hint";

/**
 * Casca padrão de todo `loading.tsx` do painel e do admin: cabeçalho REAL (mesmo `PageHeader`, com
 * o selo de `navIconFor` — não há o que carregar ali, e assim o título não "pula" na troca), um
 * espaço para o botão de ação em skeleton e o resto da página em skeleton na forma do conteúdo.
 *
 * Acessibilidade: `aria-busy` no contêiner e um "Carregando…" `sr-only` (leitor de tela anuncia a
 * espera; os blocos de skeleton são `aria-hidden`). O `InnoWaitHint` só aparece depois de 1,5s.
 */
export function PageLoading({
  icon,
  title,
  description,
  size,
  action,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  size?: "default" | "hero";
  /** Forma do botão de ação do cabeçalho (largura em classe Tailwind, ex.: "w-44"); omita se não há. */
  action?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div aria-busy="true" data-loading-page="" className={className}>
      <span role="status" className="sr-only">
        Carregando…
      </span>
      <PageHeader
        icon={icon}
        title={title}
        description={description}
        size={size}
        action={action ? <Skeleton className={cn("h-11", action)} /> : undefined}
      />
      {children}
      <InnoWaitHint />
    </div>
  );
}
