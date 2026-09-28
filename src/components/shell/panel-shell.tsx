import Link from "next/link";
import { AlertTriangle, Clock, Lock } from "lucide-react";
import { TenantSidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { LogoutButton } from "./logout-button";
import { TenantSectionLabel } from "./section-label";

type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED" | null;

type PanelShellProps = {
  tenantName: string;
  tenantSlug: string;
  userEmail: string;
  subscriptionStatus?: SubscriptionStatus;
  trialHoursLeft?: number | null;
  onboardingIncomplete?: boolean;
  whatsappNeedsAttention?: boolean;
  children: React.ReactNode;
};

/**
 * Banner global de status da assinatura (docs/arquitetura.md §7.4, decisão do dono
 * 2026-09-28): `TRIALING` avisa quantas horas faltam, `PAST_DUE` e `SUSPENDED` chamam atenção
 * para a fatura — o servidor já bloqueia escrita quando `SUSPENDED` (`assertTenantCanWrite`);
 * este banner é só a comunicação visual dessa mesma regra, nunca a fonte de verdade dela.
 */
function SubscriptionBanner({
  tenantSlug,
  status,
  trialHoursLeft,
}: {
  tenantSlug: string;
  status: SubscriptionStatus;
  trialHoursLeft?: number | null;
}) {
  if (status === "TRIALING") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg px-4 py-2 text-sm sm:px-6">
        <span className="flex items-center gap-2 text-text">
          <Clock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          {trialHoursLeft !== null && trialHoursLeft !== undefined
            ? `Seu teste termina em ${trialHoursLeft}h.`
            : "Você está no período de teste."}
        </span>
        <Link href={`/${tenantSlug}/assinatura`} className="font-medium text-primary hover:underline">
          Ver assinatura
        </Link>
      </div>
    );
  }

  if (status === "PAST_DUE") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-danger/30 bg-danger-bg px-4 py-2 text-sm sm:px-6">
        <span className="flex items-center gap-2 text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          Sua fatura está atrasada. Pague o Pix para evitar a suspensão do painel e do bot.
        </span>
        <Link href={`/${tenantSlug}/assinatura`} className="font-medium text-danger hover:underline">
          Pagar agora
        </Link>
      </div>
    );
  }

  if (status === "SUSPENDED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-danger/30 bg-danger-bg px-4 py-2 text-sm sm:px-6">
        <span className="flex items-center gap-2 text-danger">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          Assinatura suspensa: o painel está somente leitura e o bot está mudo. Pague a fatura para reativar.
        </span>
        <Link href={`/${tenantSlug}/assinatura`} className="font-medium text-danger hover:underline">
          Pagar e reativar
        </Link>
      </div>
    );
  }

  return null;
}

function Brand({ tenantName }: { tenantName: string }) {
  const initials = tenantName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-primary font-display text-sm font-bold text-white">
        {initials || "IC"}
      </div>
      <span className="truncate font-display text-sm font-bold text-sidebar-text">{tenantName}</span>
    </div>
  );
}

/**
 * Shell do painel do tenant: sidebar fixa em desktop (≥ 1024px), gaveta com
 * hambúrguer no celular, topbar fixa com nome da empresa/usuário e botão de
 * sair sempre visível. Todo o conteúdo real das páginas vem em `children`.
 */
export function PanelShell({
  tenantName,
  tenantSlug,
  userEmail,
  subscriptionStatus = null,
  trialHoursLeft = null,
  onboardingIncomplete = false,
  whatsappNeedsAttention = false,
  children,
}: PanelShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <Brand tenantName={tenantName} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <TenantSidebarNav
            tenantSlug={tenantSlug}
            onboardingIncomplete={onboardingIncomplete}
            whatsappNeedsAttention={whatsappNeedsAttention}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MobileNav
              variant="tenant"
              tenantSlug={tenantSlug}
              onboardingIncomplete={onboardingIncomplete}
              whatsappNeedsAttention={whatsappNeedsAttention}
              brand={<Brand tenantName={tenantName} />}
              footer={<LogoutButton className="w-full justify-start gap-2 text-sidebar-text hover:bg-sidebar-hover" />}
            />
            <span className="font-display text-sm font-bold text-text lg:hidden">{tenantName}</span>
            <TenantSectionLabel tenantSlug={tenantSlug} />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[14rem] truncate text-sm text-text-secondary sm:inline">
              {userEmail}
            </span>
            <LogoutButton />
          </div>
        </header>

        <SubscriptionBanner tenantSlug={tenantSlug} status={subscriptionStatus} trialHoursLeft={trialHoursLeft} />

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
