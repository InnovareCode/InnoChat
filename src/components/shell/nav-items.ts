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
  Rocket,
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

/**
 * `includeOnboarding` (docs/arquitetura.md §13, decisão do dono): o link para o assistente de
 * primeiros passos só aparece enquanto a configuração inicial (serviços, profissionais e
 * expediente) não está completa — calculado no `layout.tsx` do tenant, que já consulta o banco
 * para o banner de assinatura.
 */
export function tenantNavItems(tenantSlug: string, options: { includeOnboarding?: boolean } = {}): NavItem[] {
  const items = TENANT_NAV_DEF.map(({ label, path, icon }) => ({
    label,
    icon,
    href: `/${tenantSlug}/${path}`,
  }));

  if (options.includeOnboarding) {
    items.unshift({ label: "Primeiros passos", icon: Rocket, href: `/${tenantSlug}/onboarding` });
  }

  return items;
}

/** Itens da sidebar do admin da plataforma (docs/arquitetura.md §9, "Plataforma"). */
export const adminNavItems: NavItem[] = [
  { label: "Empresas", href: "/admin/empresas", icon: Building2 },
  { label: "Planos", href: "/admin/planos", icon: Layers },
  { label: "Cobrança", href: "/admin/cobranca", icon: Receipt },
  { label: "Configurações da plataforma", href: "/admin/configuracoes", icon: Settings },
  { label: "Saúde", href: "/admin/saude", icon: Activity },
];
