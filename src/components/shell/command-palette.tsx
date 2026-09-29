"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as RadixDialog from "@radix-ui/react-dialog";
import { CalendarPlus, MessageCircleMore, Search, UserPlus } from "lucide-react";
import { cn } from "@/components/lib/cn";
import { tenantNavItems, adminNavItems, type NavItem } from "./nav-items";

type QuickAction = { label: string; hint: string; href: string; icon: NavItem["icon"] };

/**
 * Paleta de comando (Ctrl+K, docs/design/premium-spec.md §1/§3) — modal, não input inline
 * permanente na topbar (a referência MultMarkets usa inline; o InnoAtendente já validou modal
 * como mais robusto porque não broca espaço fixo da topbar em telas com muitas seções).
 *
 * Ações rápidas são navegação simples para a tela relevante — criar/editar o registro em si
 * continua sendo responsabilidade da própria tela (ex.: "Novo agendamento" abre a Agenda, que já
 * tem seu próprio diálogo "Novo agendamento"; a paleta não duplica esse fluxo).
 */
export function CommandPalette({
  variant,
  tenantSlug,
}: { variant: "tenant"; tenantSlug: string } | { variant: "admin"; tenantSlug?: undefined }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // `setTimeout(fn, 0)` + cleanup — setState direto no corpo do efeito dispara o lint
  // `react-hooks/set-state-in-effect` (memória: bug de fetch-on-mount registrado antes).
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setQuery("");
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  const navItems = useMemo(
    () => (variant === "tenant" ? tenantNavItems(tenantSlug, { includeOnboarding: true }) : adminNavItems),
    [variant, tenantSlug],
  );

  const quickActions: QuickAction[] = useMemo(() => {
    if (variant !== "tenant") return [];
    return [
      { label: "Novo agendamento", hint: "Agenda", href: `/${tenantSlug}/agenda`, icon: CalendarPlus },
      { label: "Novo cliente", hint: "Clientes", href: `/${tenantSlug}/clientes`, icon: UserPlus },
      { label: "Conectar WhatsApp", hint: "Canal", href: `/${tenantSlug}/whatsapp`, icon: MessageCircleMore },
    ];
  }, [variant, tenantSlug]);

  const q = query.trim().toLowerCase();
  const filteredActions = q ? quickActions.filter((a) => a.label.toLowerCase().includes(q)) : quickActions;
  const filteredNav = q ? navItems.filter((i) => i.label.toLowerCase().includes(q)) : navItems;

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <button
          type="button"
          aria-label="Buscar ou ir para uma tela (Ctrl K)"
          className={cn(
            "flex h-9 w-9 items-center justify-center gap-2 rounded-full border border-border bg-surface/60 text-text-secondary",
            "transition-colors duration-150 hover:bg-surface motion-reduce:transition-none",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "sm:w-56 sm:justify-start sm:px-3.5 md:w-64",
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden truncate text-sm sm:inline">Buscar ou ir para…</span>
          <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary sm:inline">
            Ctrl K
          </kbd>
        </button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-[18%] z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2",
            "rounded-hero border border-border bg-surface shadow-card-hover",
            "focus:outline-none",
          )}
        >
          <RadixDialog.Title className="sr-only">Paleta de comando</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Busque uma tela ou execute uma ação rápida. Use as setas para navegar e Enter para escolher.
          </RadixDialog.Description>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar tela ou ação…"
              aria-label="Buscar tela ou ação"
              className="h-8 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-secondary"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {filteredActions.length > 0 ? (
              <div className="mb-1">
                <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-text-secondary">Ações rápidas</p>
                {filteredActions.map((action) => (
                  <button
                    key={action.href}
                    type="button"
                    onClick={() => go(action.href)}
                    className="flex w-full items-center gap-2.5 rounded-card px-2.5 py-2 text-left text-sm text-text hover:bg-bg focus-visible:bg-bg focus-visible:outline-none"
                  >
                    <action.icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="flex-1 truncate font-medium">{action.label}</span>
                    <span className="text-xs text-text-secondary">{action.hint}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {filteredNav.length > 0 ? (
              <div>
                <p className="px-2 py-1 text-[10px] font-black uppercase tracking-widest text-text-secondary">Telas</p>
                {filteredNav.map((item) => (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => go(item.href)}
                    className="flex w-full items-center gap-2.5 rounded-card px-2.5 py-2 text-left text-sm text-text hover:bg-bg focus-visible:bg-bg focus-visible:outline-none"
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                    <span className="truncate font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {filteredActions.length === 0 && filteredNav.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-sm text-text-secondary">Nada encontrado para &ldquo;{query}&rdquo;.</p>
            ) : null}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
