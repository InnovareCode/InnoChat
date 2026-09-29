import Link from "next/link";
import { ArrowUpCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Entra no lugar do "Adicionar número" quando o plano não comporta mais números. Compacto de
 * propósito (não é um celular fantasma): o ponto é explicar o limite e levar para o upgrade.
 */
export function PlanLimitCard({ tenantSlug, used, max }: { tenantSlug: string; used: number; max: number }) {
  return (
    <div
      data-testid="plan-limit-card"
      className="flex flex-col items-center justify-center gap-3 self-start rounded-hero border border-border bg-surface px-5 py-6 text-center shadow-card"
    >
      <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-bg text-warning">
        <Lock className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-base font-bold text-text">
          Limite do plano atingido ({used} de {max})
        </p>
        <p className="mt-1 max-w-[16rem] text-sm text-text-secondary">
          Para conectar mais um WhatsApp, mude para um plano com mais números.
        </p>
      </div>
      <Button asChild>
        <Link href={`/${tenantSlug}/assinatura`}>
          <ArrowUpCircle className="h-4 w-4" aria-hidden="true" />
          Fazer upgrade
        </Link>
      </Button>
    </div>
  );
}
