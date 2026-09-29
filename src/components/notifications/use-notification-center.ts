"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  listNotificationsAction,
  markNotificationsReadAction,
  pollNotificationsAction,
} from "@/modules/notifications/actions";
import {
  latestCreatedAt,
  mergeNotifications,
  nextPollDelay,
  pickToasts,
  stripTitleCount,
  titleWithCount,
} from "./notification-utils";
import type { AppNotification } from "./types";

export type NotificationListStatus = "loading" | "ready" | "error";

/**
 * Estado e polling do sino. Vive só no client (o painel inteiro depende dele apenas na topbar):
 *  - carrega a 1ª página ao montar (o badge precisa do número mesmo com o painel fechado);
 *  - depois `pollNotificationsAction` a cada 30 s, SÓ com a aba visível, com backoff se falhar;
 *  - novas não lidas viram toast (no máximo 3 na tela), animam o sino e vão para o `document.title`.
 */
export type NotificationCenterOptions = {
  /** Chamado a cada lote `fresh` do poll (o provider decide sobre refresh da tela). */
  onFresh?: (fresh: AppNotification[]) => void;
  /** Intervalo-base do polling neste momento (15 s em agenda/agendamentos, 30 s no resto). */
  getBaseIntervalMs?: () => number;
};

export function useNotificationCenter(tenantSlug: string, options: NotificationCenterOptions = {}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<NotificationListStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  const [ringing, setRinging] = useState(false);
  const onFreshRef = useRef(options.onFresh);
  const baseIntervalRef = useRef(options.getBaseIntervalMs);
  useEffect(() => {
    onFreshRef.current = options.onFresh;
    baseIntervalRef.current = options.getBaseIntervalMs;
  });

  // Refs: o loop de polling é de longa duração e precisa ler o valor MAIS RECENTE sem reiniciar.
  const sinceRef = useRef<string>(new Date().toISOString());
  const toastCountRef = useRef(0);
  const panelOpenRef = useRef(false);
  const cursorRef = useRef<string | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    toastCountRef.current = toasts.length;
  }, [toasts]);
  useEffect(() => {
    cursorRef.current = nextCursor;
  }, [nextCursor]);
  const itemsRef = useRef(items);
  const unreadRef = useRef(unreadCount);
  useEffect(() => {
    itemsRef.current = items;
    unreadRef.current = unreadCount;
  }, [items, unreadCount]);

  const loadFirstPage = useCallback(
    async (options: { silent: boolean }): Promise<boolean> => {
      if (!options.silent) setStatus("loading");
      try {
        const result = await listNotificationsAction({ tenantSlug });
        if (!result.ok) {
          if (!options.silent) setStatus("error");
          return false;
        }
        const { items: page, unreadCount: unread, nextCursor: cursor } = result.data;
        setItems((current) => mergeNotifications(current, page));
        setUnreadCount(unread);
        if (!options.silent || cursorRef.current === null) setNextCursor(cursor);
        sinceRef.current = latestCreatedAt(page, sinceRef.current);
        setStatus("ready");
        return true;
      } catch {
        if (!options.silent) setStatus("error");
        return false;
      }
    },
    [tenantSlug],
  );

  const ring = useCallback(() => {
    setRinging(true);
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    ringTimerRef.current = setTimeout(() => setRinging(false), 1000);
  }, []);

  // Carga inicial + polling.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    let waitingForVisibility = false;

    const schedule = () => {
      if (cancelled) return;
      timer = setTimeout(tick, nextPollDelay(failures, baseIntervalRef.current?.()));
    };

    async function tick() {
      if (cancelled) return;
      if (document.visibilityState !== "visible") {
        waitingForVisibility = true; // retoma no `visibilitychange`
        return;
      }
      try {
        const result = await pollNotificationsAction({ tenantSlug, since: sinceRef.current });
        if (cancelled) return;
        if (!result.ok) throw new Error(result.error.message);
        failures = 0;
        const { unreadCount: unread, fresh } = result.data;
        setUnreadCount(unread);
        if (fresh.length > 0) {
          sinceRef.current = latestCreatedAt(fresh, sinceRef.current);
          setItems((current) => mergeNotifications(current, fresh));
          onFreshRef.current?.(fresh);
          const unreadFresh = fresh.filter((n) => !n.read);
          if (unreadFresh.length > 0) ring();
          // Painel aberto: a lista já mostra as novas — toast em cima só atrapalha.
          const picked = panelOpenRef.current ? [] : pickToasts(fresh, toastCountRef.current);
          if (picked.length > 0) setToasts((current) => [...picked, ...current].slice(0, 3));
        }
      } catch {
        failures += 1;
      }
      schedule();
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && waitingForVisibility) {
        waitingForVisibility = false;
        if (timer) clearTimeout(timer);
        void tick();
      }
    }

    const start = setTimeout(() => {
      void loadFirstPage({ silent: false }).then(() => {
        if (!cancelled) schedule();
      });
    }, 0);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearTimeout(start);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    };
  }, [tenantSlug, loadFirstPage, ring]);

  // "(3)" no título da aba. O Next troca o <title> a cada navegação — o observer reaplica o prefixo.
  useEffect(() => {
    const apply = () => {
      const wanted = titleWithCount(document.title, unreadCount);
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    const titleEl = document.querySelector("title");
    const observer = titleEl ? new MutationObserver(apply) : null;
    if (titleEl && observer) observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      observer?.disconnect();
      document.title = stripTitleCount(document.title);
    };
  }, [unreadCount]);

  const setPanelOpen = useCallback(
    (open: boolean) => {
      panelOpenRef.current = open;
      if (open) {
        setToasts([]);
        void loadFirstPage({ silent: true });
      }
    },
    [loadFirstPage],
  );

  const loadMore = useCallback(async () => {
    if (!cursorRef.current) return;
    setLoadingMore(true);
    try {
      const result = await listNotificationsAction({ tenantSlug, cursor: cursorRef.current });
      if (result.ok) {
        setItems((current) => mergeNotifications(current, result.data.items));
        setNextCursor(result.data.nextCursor);
        setUnreadCount(result.data.unreadCount);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [tenantSlug]);

  /** Marca como lida com efeito imediato na tela; se o servidor recusar, desfaz. Devolve `false` se falhou. */
  const markRead = useCallback(
    async (input: { ids: string[] } | { all: true }): Promise<boolean> => {
      const prevItems = itemsRef.current;
      const prevUnread = unreadRef.current;
      const ids = "all" in input ? null : new Set(input.ids);
      const newlyRead = prevItems.filter((n) => !n.read && (!ids || ids.has(n.id))).length;
      setItems(prevItems.map((n) => (!ids || ids.has(n.id) ? { ...n, read: true } : n)));
      setUnreadCount(ids ? Math.max(0, prevUnread - newlyRead) : 0);
      setToasts((current) => (ids ? current.filter((n) => !ids.has(n.id)) : []));
      try {
        const result = await markNotificationsReadAction({ tenantSlug, ...input });
        if (!result.ok) throw new Error(result.error.message);
        setUnreadCount(result.data.unreadCount);
        return true;
      } catch {
        setItems(prevItems);
        setUnreadCount(prevUnread);
        return false;
      }
    },
    [tenantSlug],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((n) => n.id !== id));
  }, []);

  return {
    items,
    unreadCount,
    nextCursor,
    status,
    loadingMore,
    toasts,
    ringing,
    reload: () => loadFirstPage({ silent: false }),
    loadMore,
    markRead,
    dismissToast,
    setPanelOpen,
  };
}
