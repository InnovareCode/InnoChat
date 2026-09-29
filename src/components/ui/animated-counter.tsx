"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Número que sobe até `value` em ~600ms (docs/design/premium-spec.md §7) — usado só no número
 * grande do `StatCard`. `useReducedMotion` pula direto para o valor final: contar não é
 * informação, é só ritmo, e ninguém que pediu "sem animação" quer esperar mesmo assim.
 */
export function AnimatedCounter({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const frameRef = useRef<number | undefined>(undefined);

  // `setTimeout(fn, 0)` para o caso `reduceMotion` — setState direto no corpo do efeito dispara
  // o lint `react-hooks/set-state-in-effect` (mesma armadilha já registrada na memória). O caso
  // animado já é assíncrono por natureza (`requestAnimationFrame`), então não precisa do wrapper.
  useEffect(() => {
    if (reduceMotion) {
      const id = setTimeout(() => setDisplay(value), 0);
      return () => clearTimeout(id);
    }
    const durationMs = 600;
    const startTime = performance.now();
    const startValue = display;

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue + (value - startValue) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduceMotion]);

  return <span className="tabular-nums">{display}</span>;
}
