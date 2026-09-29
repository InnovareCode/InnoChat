"use client";

import { forwardRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/components/lib/cn";
import { Button } from "@/components/ui/button";
import { InnoAvatar, InnoFull } from "./inno-mascot";
import { TOUR_UI, type TourStepContent } from "./inno-script";
import type { Side } from "./tour-geometry";

export type BalloonLayout =
  | { kind: "sheet" }
  | { kind: "center" }
  | { kind: "anchored"; side: Side; left: number; top: number; arrow: number };

type Props = {
  step: TourStepContent;
  body: string;
  /** Posição do passo (1-based) e total, para o "3 de 10". */
  position: number;
  total: number;
  layout: BalloonLayout;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

/** Ponta do balão apontando para o alvo — quadrado girado com as duas bordas voltadas ao alvo. */
function Tail({ side, arrow }: { side: Side; arrow: number }) {
  const base = "absolute h-3 w-3 rotate-45 bg-surface border-border";
  if (side === "right") return <span aria-hidden="true" className={cn(base, "-left-1.5 border-b border-l")} style={{ top: arrow - 6 }} />;
  if (side === "left") return <span aria-hidden="true" className={cn(base, "-right-1.5 border-r border-t")} style={{ top: arrow - 6 }} />;
  if (side === "bottom") return <span aria-hidden="true" className={cn(base, "-top-1.5 border-l border-t")} style={{ left: arrow - 6 }} />;
  return <span aria-hidden="true" className={cn(base, "-bottom-1.5 border-b border-r")} style={{ left: arrow - 6 }} />;
}

/**
 * Balão de fala do Inno. Puramente visual: quem decide posição, passo e o que cada botão faz é
 * `OnboardingTour`. O texto fica numa região `aria-live="polite"` para leitores de tela
 * anunciarem cada passo quando o balão troca (o foco vai para o botão principal).
 *
 * Três formas: `anchored` (perto do alvo, com ponta), `center` (sem alvo — boas-vindas, fim, ou
 * alvo ausente) e `sheet` (bottom sheet no celular).
 */
export const TourBalloon = forwardRef<HTMLDivElement, Props>(function TourBalloon(
  { step, body, position, total, layout, onNext, onBack, onSkip },
  ref,
) {
  const reduceMotion = useReducedMotion();
  const isFirst = position === 1;
  const isLast = position === total;
  const big = step.kind !== "step";
  const titleId = `tour-title-${step.id}`;

  const nextLabel = step.kind === "welcome" ? TOUR_UI.start : isLast ? TOUR_UI.finish : TOUR_UI.next;

  const positionClass =
    layout.kind === "sheet"
      ? "fixed inset-x-0 bottom-0 max-h-[90dvh] rounded-t-hero border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)]"
      : layout.kind === "center"
        ? "fixed left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-hero"
        : "fixed w-[22.5rem] max-w-[calc(100vw-1.5rem)] rounded-hero";

  const style = layout.kind === "anchored" ? { left: layout.left, top: layout.top } : undefined;

  // O `translate` do centro é feito por classes (Tailwind), então a animação de entrada usa
  // só `opacity` + `scale`/`y`, que não brigam com ele: framer aplica em `transform`, e o
  // Tailwind v4 usa as propriedades `translate` individuais.
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-tour-balloon=""
      className={cn(
        "z-[80] flex flex-col border border-border bg-surface text-text shadow-card-hover",
        positionClass,
      )}
      style={style}
      initial={reduceMotion ? false : { opacity: 0, y: layout.kind === "sheet" ? 24 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {layout.kind === "anchored" ? <Tail side={layout.side} arrow={layout.arrow} /> : null}

      <div aria-live="polite" aria-atomic="true" className={cn("flex min-h-0 gap-4 overflow-y-auto p-5", big && layout.kind !== "sheet" ? "sm:items-center" : "")}>
        {big ? (
          <InnoFull className={cn("shrink-0", layout.kind === "sheet" ? "w-16" : "w-24 sm:w-40")} priority={step.kind === "welcome"} />
        ) : (
          <InnoAvatar size={44} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tabular-nums text-text-secondary">
            {TOUR_UI.progress(position, total)}
          </p>
          <h2 id={titleId} className={cn("mt-0.5 font-display font-bold text-text", big ? "text-xl" : "text-base")}>
            {step.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{body}</p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        {isLast ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={onSkip} className="-ml-3 text-text-secondary">
            {TOUR_UI.skip}
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {isFirst ? null : (
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              {TOUR_UI.back}
            </Button>
          )}
          <Button type="button" variant="primary" size="sm" onClick={onNext} data-tour-primary="">
            {nextLabel}
          </Button>
        </div>
      </div>
    </motion.div>
  );
});
