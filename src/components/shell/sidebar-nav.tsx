"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/lib/cn";
import { adminNavItems, tenantNavItems, type NavItem } from "./nav-items";

/**
 * `NavItem[]` carrega o componente do ícone (lucide-react) como VALOR —
 * passar isso como prop de um Server Component para um Client Component
 * quebra ("Only plain objects can be passed..."), porque um componente React
 * não é serializável através da fronteira servidor/cliente. Por isso os
 * itens nunca vêm de fora: cada variante resolve a própria lista aqui
 * dentro, já no lado do cliente (import direto, não prop).
 */
function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 text-sm" aria-label="Navegação principal">
      {items.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-2.5 rounded-card px-3 py-2 font-medium text-sidebar-text",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              active
                ? "bg-sidebar-active text-sidebar-active-text"
                : "hover:bg-sidebar-hover",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function TenantSidebarNav({
  tenantSlug,
  onboardingIncomplete,
  onNavigate,
}: {
  tenantSlug: string;
  onboardingIncomplete?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavList items={tenantNavItems(tenantSlug, { includeOnboarding: onboardingIncomplete })} onNavigate={onNavigate} />
  );
}

export function AdminSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList items={adminNavItems} onNavigate={onNavigate} />;
}
