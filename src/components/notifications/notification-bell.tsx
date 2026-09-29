"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/components/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { NotificationItem } from "./notification-item";
import { NotificationToasts } from "./notification-toasts";
import { badgeText, groupNotifications, unreadAriaLabel } from "./notification-utils";
import { useNotificationCenterContext } from "./notification-center-provider";
import type { BellNotification } from "./types";

type Filter = "all" | "unread";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Sino da topbar: badge de não lidas, painel (popover no desktop, sheet embaixo no celular — o
 * mesmo DOM, a diferença é só CSS), toasts de novas e polling. Foco: ao abrir vai para o painel,
 * Tab circula dentro dele, Esc / clique fora / item escolhido fecham e devolvem o foco ao sino.
 */
export function NotificationBell({
  timezone,
  emptyHint = "Novos agendamentos, remarcações e avisos importantes aparecem aqui.",
}: {
  timezone: string;
  /** Texto do estado vazio "Todas" — o admin da plataforma tem outros tipos de aviso. */
  emptyHint?: string;
}) {
  const { notify } = useToast();
  const center = useNotificationCenterContext();
  const { items, unreadCount, nextCursor, status, loadingMore, toasts, ringing, markRead, dismissToast, setPanelOpen } = center;

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const titleId = useId();

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const changeOpen = useCallback(
    (next: boolean, options: { restoreFocus?: boolean } = {}) => {
      setOpen(next);
      setPanelOpen(next);
      if (next) {
        setNow(new Date());
      } else if (options.restoreFocus !== false) {
        buttonRef.current?.focus();
      }
    },
    [setPanelOpen],
  );

  // Foco inicial no painel ao abrir.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Tempo relativo vivo enquanto o painel está aberto.
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, [open]);

  // Clique fora fecha (o foco fica onde o usuário clicou).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      changeOpen(false, { restoreFocus: false });
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, changeOpen]);

  function onPanelKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      changeOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const activate = useCallback(
    async (notification: BellNotification) => {
      changeOpen(false, { restoreFocus: false });
      dismissToast(notification.id);
      if (!notification.read) {
        const ok = await markRead({ ids: [notification.id] });
        if (!ok) notify({ variant: "error", title: "Não deu para marcar como lida", description: "Tente de novo em instantes." });
      }
    },
    [changeOpen, dismissToast, markRead, notify],
  );

  async function markAll() {
    const ok = await markRead({ all: true });
    if (!ok) notify({ variant: "error", title: "Não deu para marcar tudo como lido", description: "Tente de novo em instantes." });
  }

  const visible = useMemo(() => (filter === "unread" ? items.filter((n) => !n.read) : items), [items, filter]);
  const groups = useMemo(() => groupNotifications(visible, timezone, now), [visible, timezone, now]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => changeOpen(!open)}
        aria-label={unreadAriaLabel(unreadCount)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface/70 text-text-secondary",
          "transition-colors duration-150 hover:bg-bg hover:text-text motion-reduce:transition-none",
          open && "bg-bg text-text",
        )}
      >
        <Bell className={cn("h-5 w-5", ringing && "notif-bell-ring")} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white ring-2 ring-surface tabular-nums"
          >
            {badgeText(unreadCount)}
          </span>
        ) : null}
      </button>

      <NotificationToasts toasts={toasts} onDismiss={dismissToast} onView={activate} />

      {open && mounted
        ? createPortal(
            <>
              <div className="fixed inset-0 z-[70] bg-black/40 sm:hidden" aria-hidden="true" />
              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-labelledby={titleId}
                tabIndex={-1}
                onKeyDown={onPanelKeyDown}
                className={cn(
                  "notif-panel fixed z-[80] flex flex-col overflow-hidden border border-border bg-surface shadow-card-hover focus:outline-none",
                  // Celular: sheet colado embaixo. Desktop: popover ancorado sob a topbar.
                  "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-hero",
                  "sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-[4.25rem] sm:max-h-[min(34rem,calc(100dvh-5.5rem))] sm:w-[26rem] sm:rounded-hero",
                )}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <h2 id={titleId} className="font-display text-base font-bold text-text">
                    Notificações
                  </h2>
                  <button
                    type="button"
                    onClick={markAll}
                    disabled={unreadCount === 0}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-card px-2 text-sm font-medium text-primary transition-colors duration-150 hover:bg-bg disabled:cursor-not-allowed disabled:text-text-secondary disabled:opacity-60 disabled:hover:bg-transparent motion-reduce:transition-none"
                  >
                    <CheckCheck className="h-4 w-4" aria-hidden="true" />
                    Marcar todas como lidas
                  </button>
                </div>

                <div className="flex items-center gap-2 border-b border-border px-4 py-2" role="group" aria-label="Filtrar notificações">
                  {(["all", "unread"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                      className={cn(
                        "inline-flex min-h-[44px] items-center rounded-full px-3.5 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none",
                        filter === value ? "bg-primary text-white" : "text-text-secondary hover:bg-bg hover:text-text",
                      )}
                    >
                      {value === "all" ? "Todas" : `Não lidas${unreadCount > 0 ? ` (${unreadCount})` : ""}`}
                    </button>
                  ))}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {status === "loading" ? (
                    <div className="flex flex-col gap-3 p-4" aria-busy="true">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-2/3 rounded-card" />
                            <Skeleton className="mt-2 h-3 w-full rounded-card" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : status === "error" && items.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                      <p className="text-sm text-text-secondary">Não deu para carregar as notificações agora.</p>
                      <button
                        type="button"
                        onClick={() => void center.reload()}
                        className="inline-flex min-h-[44px] items-center rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg"
                      >
                        Tentar de novo
                      </button>
                    </div>
                  ) : visible.length === 0 ? (
                    <EmptyNotifications filter={filter} hint={emptyHint} />
                  ) : (
                    <>
                      {groups.map((group) => (
                        <section key={group.key} aria-label={group.label}>
                          <h3 className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                            {group.label}
                          </h3>
                          <ul className="divide-y divide-border">
                            {group.items.map((notification) => (
                              <NotificationItem key={notification.id} notification={notification} now={now} onActivate={activate} />
                            ))}
                          </ul>
                        </section>
                      ))}
                      {nextCursor ? (
                        <div className="border-t border-border p-2">
                          <button
                            type="button"
                            onClick={() => void center.loadMore()}
                            disabled={loadingMore}
                            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-card text-sm font-medium text-primary transition-colors duration-150 hover:bg-bg disabled:opacity-60 motion-reduce:transition-none"
                          >
                            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
                            Carregar mais
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}

function EmptyNotifications({ filter, hint }: { filter: Filter; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <Image src="/mascote/inno-avatar.webp" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-full" />
      <div>
        <p className="font-display text-base font-bold text-text">Tudo em dia por aqui</p>
        <p className="mt-1 text-sm text-text-secondary">
          {filter === "unread"
            ? "Você não tem notificações não lidas."
            : hint}
        </p>
      </div>
    </div>
  );
}
