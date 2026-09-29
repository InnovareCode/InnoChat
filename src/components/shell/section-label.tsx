"use client";

import { usePathname } from "next/navigation";
import { CircleUser } from "lucide-react";
import { adminNavItems, tenantNavItems, type NavItem } from "./nav-items";

/** Página fora do menu (abre pelo bloco do usuário) — mesmo assim a topbar diz onde a pessoa está. */
const account = (href: string): NavItem => ({ label: "Minha conta", href, icon: CircleUser });

/**
 * Nome da seção atual na topbar (desktop) — antes a topbar em telas ≥1024px
 * só tinha e-mail + Sair à direita, com o lado esquerdo vazio (a marca só
 * aparece no celular, junto do hambúrguer). Resolve o nome pela mesma lógica
 * de "ativo" da sidebar (`pathname === href` ou prefixo), sem repetir o
 * array de navegação como prop (ver nota em `sidebar-nav.tsx` sobre não
 * cruzar ícone de componente pela fronteira servidor/cliente).
 */
function activeLabel(items: NavItem[], pathname: string | null): string | null {
  if (!pathname) return null;
  const match = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.label ?? null;
}

export function TenantSectionLabel({ tenantSlug }: { tenantSlug: string }) {
  const pathname = usePathname();
  const label = activeLabel([...tenantNavItems(tenantSlug, { includeOnboarding: true }), account(`/${tenantSlug}/minha-conta`)], pathname);
  if (!label) return null;
  return <p className="hidden font-display text-sm font-bold text-text lg:block">{label}</p>;
}

export function AdminSectionLabel() {
  const pathname = usePathname();
  const label = activeLabel([...adminNavItems, account("/admin/minha-conta")], pathname);
  if (!label) return null;
  return <p className="hidden font-display text-sm font-bold text-text lg:block">{label}</p>;
}
