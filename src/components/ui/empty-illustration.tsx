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

/** Usada em Clientes (§8/onda 1) — o vazio "sem clientes ainda" é a próxima ação óbvia. */
export function PeopleEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" fill="none" className={className} aria-hidden="true">
      <circle cx="46" cy="34" r="14" stroke="currentColor" strokeWidth="3" opacity="0.55" />
      <path d="M22 82c0-15 10-24 24-24s24 9 24 24" stroke="currentColor" strokeWidth="3" opacity="0.4" />
      <circle cx="82" cy="30" r="10" stroke="currentColor" strokeWidth="3" opacity="0.35" />
      <path d="M72 58c8-2 20 2 24 16" stroke="currentColor" strokeWidth="3" opacity="0.3" />
    </svg>
  );
}

/** Usada em WhatsApp (§8/onda 1) — "conecte seu primeiro número" é a próxima ação óbvia. */
export function WhatsappEmptyIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 96" fill="none" className={className} aria-hidden="true">
      <rect x="42" y="12" width="36" height="72" rx="8" stroke="currentColor" strokeWidth="3" opacity="0.5" />
      <path d="M50 22h20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <circle cx="60" cy="72" r="3" fill="currentColor" opacity="0.6" />
      <path
        d="M14 40a12 12 0 0 1 12-12h6v24a12 12 0 0 1-12 12H14l6-8a12 12 0 0 1-6-16Z"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.35"
      />
    </svg>
  );
}
