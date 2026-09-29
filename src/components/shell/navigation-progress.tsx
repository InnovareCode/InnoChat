"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/components/lib/cn";

/**
 * Barra de progresso de navegação (topo da tela, 3px, cor primária do tema, com brilho).
 *
 * O App Router do Next 16 não tem router events. Estratégia: um listener de clique no `document`
 * (fase de captura) detecta clique em link interno e "arma" a barra; ela só APARECE depois de
 * `SHOW_DELAY_MS` (navegação instantânea — rota já pré-carregada — nunca pisca a barra). A barra
 * completa quando `usePathname()`/`useSearchParams()` mudam, isto é, quando a nova rota é
 * confirmada (com `loading.tsx`, é o momento em que o skeleton entra). Um limite de
 * `MAX_MS` recolhe a barra se a navegação nunca vier (link cancelado por outro handler).
 *
 * Não cobre `router.push()` programático (sem clique em `<a>`), que o Next resolve sozinho.
 * Decorativa: `role="progressbar"` + `aria-hidden` — o anúncio de "Carregando…" é dos skeletons.
 */
const SHOW_DELAY_MS = 120;
const MAX_MS = 15000;
const TRICKLE_MS = 220;

type Phase = "idle" | "running" | "finishing";

function isModifiedClick(e: MouseEvent) {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
}

/** Devolve a URL de destino se o clique é numa navegação interna que muda a rota; senão null. */
export function internalNavigationTarget(anchor: HTMLAnchorElement, current: Location): URL | null {
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const rawHref = anchor.getAttribute("href");
  if (!rawHref || rawHref.startsWith("#")) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, current.href);
  } catch {
    return null;
  }
  if (url.origin !== current.origin) return null;
  if (url.pathname === current.pathname && url.search === current.search) return null;
  return url;
}

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);

  const armedRef = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceRef = useRef(false);

  const clearTimers = useCallback(() => {
    for (const t of [showTimer, maxTimer, hideTimer]) {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    }
    if (trickleTimer.current) clearInterval(trickleTimer.current);
    trickleTimer.current = null;
  }, []);

  const finish = useCallback(() => {
    const wasArmed = armedRef.current;
    armedRef.current = false;
    // Navegação que terminou antes de a barra aparecer não mostra nada.
    if (!wasArmed) return;
    clearTimers();
    setPhase((current) => (current === "running" ? "finishing" : "idle"));
    setProgress(100);
    hideTimer.current = setTimeout(
      () => {
        setPhase("idle");
        setProgress(0);
      },
      reduceRef.current ? 0 : 340,
    );
  }, [clearTimers]);

  // Detecta a preferência no cliente (o markup inicial é idêntico no servidor e no cliente).
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduceRef.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Clique em link interno arma a barra.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (isModifiedClick(e) || !(e.target instanceof Element)) return;
      const anchor = e.target.closest("a");
      if (!anchor) return;
      if (!internalNavigationTarget(anchor, window.location)) return;

      clearTimers();
      armedRef.current = true;
      showTimer.current = setTimeout(() => {
        if (!armedRef.current) return;
        setPhase("running");
        setProgress(reduceRef.current ? 70 : 12);
        if (!reduceRef.current) {
          trickleTimer.current = setInterval(() => {
            setProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.12));
          }, TRICKLE_MS);
        }
      }, SHOW_DELAY_MS);
      maxTimer.current = setTimeout(finish, MAX_MS);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, [clearTimers, finish]);

  // Rota confirmada: completa a barra (adiado um tick para não setar estado dentro do efeito).
  useEffect(() => {
    const id = setTimeout(finish, 0);
    return () => clearTimeout(id);
  }, [routeKey, finish]);

  return (
    <div
      role="progressbar"
      aria-hidden="true"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
      data-testid="nav-progress"
      data-state={phase}
      style={{ transitionDelay: phase === "finishing" ? "120ms" : "0ms" }}
      className={cn(
        "nav-progress-fade pointer-events-none fixed inset-x-0 top-0 z-[110] h-[3px]",
        phase === "running" ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className="nav-progress-run nav-progress-bar h-full w-full origin-left bg-primary"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
