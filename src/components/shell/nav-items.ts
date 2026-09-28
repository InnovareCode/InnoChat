import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  Layers,
  MessageCircle,
  Receipt,
  Scissors,
  Settings,
  Activity,
  UserRound,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

/**
 * Itens da sidebar do painel do tenant (docs/arquitetura.md §9 + escopo
 * combinado com o dono para esta fase — "Bloqueios e feriados" e
 * "Atendimentos" entram nas Fases 2 e 8, quando as telas existirem).
 * `href` é relativo à raiz do tenant (`/{tenantSlug}`); `tenantNavItems(slug)`
 * resolve o caminho absoluto.
 */
const TENANT_NAV_DEF: { label: string; path: string; icon: LucideIcon }[] = [
  { label: "Agenda", path: "agenda", icon: Calendar },
  { label: "Agendamentos", path: "agendamentos", icon: ClipboardList },
  { label: "Serviços", path: "servicos", icon: Scissors },
  { label: "Profissionais", path: "profissionais", icon: UserRound },
  { label: "WhatsApp", path: "whatsapp", icon: MessageCircle },
  { label: "Mensagens do bot", path: "mensagens-bot", icon: Bot },
  { label: "Clientes", path: "clientes", icon: Users },
  { label: "Configurações", path: "configuracoes", icon: Settings },
  { label: "Assinatura", path: "assinatura", icon: CreditCard },
];

export function tenantNavItems(tenantSlug: string): NavItem[] {
  return TENANT_NAV_DEF.map(({ label, path, icon }) => ({
    label,
    icon,
    href: `/${tenantSlug}/${path}`,
  }));
}

/** Itens da sidebar do admin da plataforma (docs/arquitetura.md §9, "Plataforma"). */
export const adminNavItems: NavItem[] = [
  { label: "Empresas", href: "/admin/empresas", icon: Building2 },
  { label: "Planos", href: "/admin/planos", icon: Layers },
  { label: "Cobrança", href: "/admin/cobranca", icon: Receipt },
  { label: "Configurações da plataforma", href: "/admin/configuracoes", icon: Settings },
  { label: "Saúde", href: "/admin/saude", icon: Activity },
];
