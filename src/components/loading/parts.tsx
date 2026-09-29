import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/lib/cn";

/**
 * Peças de skeleton reutilizadas pelos `loading.tsx`. Cada uma imita as MEDIDAS do componente real
 * (mesmo `Card`/`rounded-hero`, mesma altura de linha, mesmo espaçamento) — é o que evita layout
 * shift na troca. Se o componente real mudar de altura, ajuste a peça aqui (fonte única).
 */

/** Chip de contagem acima das listas ("12 clientes"): `py-1` + `text-xs` + borda = 26px. */
export function CountChipSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("mb-4 flex items-center gap-2", className)}>
      <Skeleton className="h-[26px] w-40 rounded-full" />
    </div>
  );
}

/** Um campo de formulário (label 20px + mb 6px + input 44px). */
function FieldSkeleton({ labelWidth = "w-16" }: { labelWidth?: string }) {
  return (
    <div>
      <Skeleton className={cn("mb-1.5 h-5", labelWidth)} />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

/** Cartão de filtros em grade (Agendamentos): 4 campos, 2 colunas em `sm`, 4 em `lg`. */
export function FilterGridCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card className="mb-4 rounded-hero p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: fields }).map((_, i) => (
          <FieldSkeleton key={i} labelWidth={i % 2 ? "w-12" : "w-20"} />
        ))}
      </div>
    </Card>
  );
}

/** Cartão de busca + chips (Clientes). */
export function SearchCardSkeleton({ chips = 4 }: { chips?: number }) {
  return (
    <Card className="mb-4 flex flex-col gap-3 rounded-hero p-4">
      <Skeleton className="h-11 w-full" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: chips }).map((_, i) => (
          <Skeleton key={i} className={cn("h-[34px] rounded-full", i === 0 ? "w-16" : "w-24")} />
        ))}
      </div>
    </Card>
  );
}

/**
 * Tabela em cartão (`rounded-hero`) no desktop e lista de cartões no celular — o mesmo par
 * `hidden md:block` / `md:hidden` das telas reais. Linha de tabela = 45px (`py-3` + texto 20px +
 * borda); cabeçalho = 44px.
 */
export function TableCardSkeleton({
  columns = 5,
  rows = 6,
  mobileRows = 4,
  avatarColumn = false,
}: {
  columns?: number;
  rows?: number;
  mobileRows?: number;
  /** Primeira coluna com avatar redondo + duas linhas de texto (Clientes, Profissionais, Empresas). */
  avatarColumn?: boolean;
}) {
  return (
    <>
      <Card className="hidden rounded-hero md:block">
        <div className="overflow-hidden rounded-card border border-border">
          <div className="flex items-center gap-6 bg-bg px-4 py-3">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className={cn("h-5 flex-1", i === columns - 1 && "max-w-16")} />
            ))}
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className={cn("flex items-center gap-6 px-4", avatarColumn ? "py-3" : "py-3")}>
                {Array.from({ length: columns }).map((_, c) =>
                  c === 0 && avatarColumn ? (
                    <div key={c} className="flex flex-1 items-center gap-2.5">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <div className="flex flex-1 flex-col gap-1.5">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ) : (
                    <Skeleton key={c} className={cn("h-5 flex-1", c === columns - 1 && "max-w-16")} />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
      <MobileCardsSkeleton count={mobileRows} />
    </>
  );
}

/** Lista de cartões do celular (`md:hidden`), como as linhas de tabela viram cartões. */
export function MobileCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="rounded-hero p-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-3/4" />
          <Skeleton className="mt-2.5 h-4 w-1/3" />
        </Card>
      ))}
    </div>
  );
}

/** Cartão de estatística (mesmo `rounded-hero`, `p-5`): selo redondo, rótulo, número, contexto. */
export function StatCardSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div
      className={cn(
        "border border-border bg-surface p-5 shadow-card",
        hero ? "rounded-hero-lg" : "rounded-hero",
      )}
    >
      <Skeleton className="mb-4 h-11 w-11 rounded-full" />
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="mt-1 h-10 w-1/3" />
      <Skeleton className="mt-3 h-[26px] w-32 rounded-full" />
    </div>
  );
}

export function StatGridSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} hero={i === 0} />
      ))}
    </div>
  );
}

/** Cartão com cabeçalho (título + descrição) e corpo — Configurações, Assinatura, Admin etc. */
export function SectionCardSkeleton({
  bodyHeight = "h-24",
  className,
  withFooter = false,
}: {
  bodyHeight?: string;
  className?: string;
  withFooter?: boolean;
}) {
  return (
    <Card className={cn("rounded-hero", className)}>
      <div className="flex flex-col gap-2 p-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-2/3 max-w-md" />
      </div>
      <div className="px-5 pb-5">
        <Skeleton className={cn("w-full", bodyHeight)} />
      </div>
      {withFooter ? (
        <div className="flex justify-end border-t border-border p-4">
          <Skeleton className="h-11 w-28" />
        </div>
      ) : null}
    </Card>
  );
}
