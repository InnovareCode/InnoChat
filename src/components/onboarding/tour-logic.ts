import type { TourStepContent } from "./inno-script";

/** Breakpoint `lg` do Tailwind — a sidebar fixa só existe a partir daqui. */
export const DESKTOP_MIN_WIDTH = 1024;
/** Abaixo disto o balão vira bottom sheet (`sm` do Tailwind). */
export const SHEET_MAX_WIDTH = 640;

export function stepsForViewport(steps: TourStepContent[], isDesktop: boolean): TourStepContent[] {
  return isDesktop ? steps : steps.filter((s) => !s.desktopOnly);
}

/** `data-tour` a procurar para o passo, já considerando a largura da tela. */
export function targetFor(step: TourStepContent, isDesktop: boolean): string | undefined {
  return !isDesktop && step.targetMobile ? step.targetMobile : step.target;
}

export function bodyFor(step: TourStepContent, isDesktop: boolean): string {
  return !isDesktop && step.bodyMobile ? step.bodyMobile : step.body;
}

export type TourNav = { index: number; done: boolean };

/** Próximo passo; no último, `done` (concluir). */
export function goNext(index: number, total: number): TourNav {
  return index >= total - 1 ? { index, done: true } : { index: index + 1, done: false };
}

export function goBack(index: number): TourNav {
  return { index: Math.max(0, index - 1), done: false };
}

export type TourKeyAction = "next" | "back" | "skip" | "block" | null;

/**
 * Teclado do tour: setas navegam, Esc pula. Ctrl/Cmd+K é bloqueado — a paleta de comando ficaria
 * por baixo do overlay do tour, sem foco possível.
 */
export function keyToAction(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): TourKeyAction {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") return "block";
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "ArrowRight") return "next";
  if (e.key === "ArrowLeft") return "back";
  if (e.key === "Escape") return "skip";
  return null;
}

/** Índice do próximo elemento focável dentro do balão (foco preso: dá a volta nas pontas). */
export function nextFocusIndex(current: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1;
  if (current < 0) return backwards ? count - 1 : 0;
  return backwards ? (current - 1 + count) % count : (current + 1) % count;
}
