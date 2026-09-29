/**
 * Ilustrações leves de estado vazio (docs premium, pacote "identidade visual") — SVG inline,
 * `currentColor`, sem banco de imagem externo (CSP não precisa de exceção nenhuma). Só entra na
 * variante `highlight` do `EmptyState` (o vazio que É a próxima ação óbvia).
 */
export function CalendarEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" fill="none" className={className} aria-hidden="true">
      <rect x="14" y="18" width="92" height="70" rx="10" stroke="currentColor" strokeWidth="3" opacity="0.5" />
      <path d="M14 38h92" stroke="currentColor" strokeWidth="3" opacity="0.5" />
      <path d="M36 10v16M84 10v16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <circle cx="60" cy="63" r="14" stroke="currentColor" strokeWidth="3" opacity="0.35" />
      <path d="M60 56v7l5 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function ChatEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" fill="none" className={className} aria-hidden="true">
      <path
        d="M20 24a10 10 0 0 1 10-10h60a10 10 0 0 1 10 10v34a10 10 0 0 1-10 10H48l-18 16V68h-0a10 10 0 0 1-10-10Z"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.45"
      />
      <circle cx="45" cy="41" r="4" fill="currentColor" opacity="0.6" />
      <circle cx="60" cy="41" r="4" fill="currentColor" opacity="0.6" />
      <circle cx="75" cy="41" r="4" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
