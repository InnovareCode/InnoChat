import { TenantSidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { LogoutButton } from "./logout-button";
import { TenantSectionLabel } from "./section-label";

type PanelShellProps = {
  tenantName: string;
  tenantSlug: string;
  userEmail: string;
  children: React.ReactNode;
};

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
export function PanelShell({ tenantName, tenantSlug, userEmail, children }: PanelShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <Brand tenantName={tenantName} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <TenantSidebarNav tenantSlug={tenantSlug} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MobileNav
              variant="tenant"
              tenantSlug={tenantSlug}
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

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
