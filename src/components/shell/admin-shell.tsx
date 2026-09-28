import { AdminSidebarNav } from "./sidebar-nav";
import { MobileNav } from "./mobile-nav";
import { LogoutButton } from "./logout-button";
import { AdminSectionLabel } from "./section-label";

type AdminShellProps = {
  userEmail: string;
  children: React.ReactNode;
};

function AdminBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card bg-primary font-display text-sm font-bold text-white">
        IC
      </div>
      <span className="truncate font-display text-sm font-bold text-sidebar-text">
        InnoChat · Plataforma
      </span>
    </div>
  );
}

/** Shell do admin da plataforma — mesmo padrão do painel do tenant, tema fixo Índigo Clínico. */
export function AdminShell({ userEmail, children }: AdminShellProps) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <div className="mb-8 px-2">
          <AdminBrand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminSidebarNav />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MobileNav
              variant="admin"
              brand={<AdminBrand />}
              footer={<LogoutButton className="w-full justify-start gap-2 text-sidebar-text hover:bg-sidebar-hover" />}
            />
            <span className="font-display text-sm font-bold text-text lg:hidden">Plataforma</span>
            <AdminSectionLabel />
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
