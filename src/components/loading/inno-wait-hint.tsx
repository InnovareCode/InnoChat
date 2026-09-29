import { InnoAvatar } from "@/components/onboarding/inno-mascot";

/**
 * Espera longa: depois de 1,5s carregando, o Inno (avatar pequeno) aparece pulsando no canto com
 * "Ainda carregando…". Só CSS (`.inno-wait`, globals.css — `animation-delay`), então navegações
 * rápidas nunca o mostram. NÃO usar em toda navegação: o padrão é barra de topo + skeleton.
 * Fica acima da barra do selo InnovareCode e abaixo dos toasts; `aria-hidden` (o aviso falado é
 * o "Carregando…" do `PageLoading`).
 */
export function InnoWaitHint() {
  return (
    <div
      aria-hidden="true"
      data-testid="inno-wait-hint"
      className="inno-wait fixed bottom-16 left-4 z-30 flex items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pl-1.5 pr-4 text-xs font-medium text-text-secondary shadow-card sm:left-auto sm:right-6"
    >
      <span className="inno-wait-pulse inline-flex">
        <InnoAvatar size={32} />
      </span>
      Ainda carregando…
    </div>
  );
}
