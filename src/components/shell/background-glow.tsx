/**
 * Brilho de fundo (docs/design/premium-spec.md §1/§5, decisão do dono: SIM, sutil). Puro CSS
 * (`.panel-background-glow`, `globals.css`) — sem motion nem estado, por isso Server Component.
 * Uma única instância por shell (`panel-shell.tsx`/`admin-shell.tsx`), nunca por página.
 */
export function BackgroundGlow() {
  return <div className="panel-background-glow" aria-hidden="true" />;
}
