import { LogoutButton } from "./logout-button";

/**
 * Bloco de usuário no rodapé da sidebar (docs/design/premium-spec.md §1/§2) — nome/e-mail e
 * "Sair" juntos, mais fácil de auditar num relance do que separar (e-mail na topbar, sair
 * escondido embaixo). Vence a referência MultMarkets nesse ponto específico.
 */
export function UserBlock({ userEmail }: { userEmail: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-white/10 bg-white/5 p-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-sidebar-text">
        {(userEmail[0] ?? "?").toUpperCase()}
      </div>
      <span className="min-w-0 flex-1 truncate text-xs text-sidebar-text/80">{userEmail}</span>
      <LogoutButton iconOnly className="shrink-0 text-sidebar-text hover:bg-white/10" />
    </div>
  );
}
