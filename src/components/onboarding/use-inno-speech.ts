"use client";

import { useCallback, useEffect, useReducer, useSyncExternalStore } from "react";
import { MS_PER_CHAR, dotsDuration, initTypewriter, typewriterReducer, visibleText, type TypewriterState } from "./typewriter";

const QUERY = "(prefers-reduced-motion: reduce)";

/** `prefers-reduced-motion`. No servidor é `false` (o cliente corrige logo após a hidratação). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(QUERY);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

const SEEN_PREFIX = "innochat:inno-spoke:";

function alreadySpoke(key: string | undefined): boolean {
  if (!key) return false;
  try {
    return sessionStorage.getItem(SEEN_PREFIX + key) === "1";
  } catch {
    return false;
  }
}
function markSpoke(key: string | undefined) {
  if (!key) return;
  try {
    sessionStorage.setItem(SEEN_PREFIX + key, "1");
  } catch {
    /* modo privado: só perde o "uma vez por sessão" */
  }
}

export type InnoSpeech = {
  phase: TypewriterState["phase"];
  /** Trecho já "digitado". */
  visible: string;
  /** Completa na hora (clique/tecla). */
  complete: () => void;
};

/**
 * Fala do Inno: "digitando…" (600–900 ms) → máquina de escrever (~28 ms/caractere) → pronto.
 * - `prefers-reduced-motion`: o texto aparece direto, sem digitar.
 * - `onceKey`: falas de páginas que se revisitam (checklist, parabéns) só animam a 1ª vez por
 *   sessão; nas próximas o texto já aparece inteiro.
 * - Qualquer tecla (exceto Tab e modificadores) completa a fala; o clique é ligado por quem usa
 *   (`complete`). O botão "Próximo" nunca espera a animação.
 */
export function useInnoSpeech(text: string, options: { onceKey?: string } = {}): InnoSpeech {
  const { onceKey } = options;
  const reduced = usePrefersReducedMotion();
  const [state, dispatch] = useReducer(typewriterReducer, undefined, () => initTypewriter(text, false));

  // (Re)inicia quando o texto muda: reduced/já-falou pulam para "pronto". Agendado por timeout
  // (nunca setState síncrono no corpo do efeito).
  useEffect(() => {
    const id = window.setTimeout(() => {
      dispatch({ type: "reset", text, reduced: reduced || alreadySpoke(onceKey) });
    }, 0);
    return () => window.clearTimeout(id);
  }, [text, reduced, onceKey]);

  const { phase, total } = state;

  useEffect(() => {
    if (phase !== "dots") return;
    const id = window.setTimeout(() => dispatch({ type: "start" }), dotsDuration(total));
    return () => window.clearTimeout(id);
  }, [phase, total]);

  useEffect(() => {
    if (phase !== "typing") return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), MS_PER_CHAR);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "done") markSpoke(onceKey);
  }, [phase, onceKey]);

  // Tecla completa a fala (sem impedir nada: Enter/Espaço/setas continuam funcionando).
  useEffect(() => {
    if (phase === "done") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Tab" || e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
      dispatch({ type: "complete" });
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [phase]);

  const complete = useCallback(() => dispatch({ type: "complete" }), []);
  return { phase, visible: visibleText(text, state.count), complete };
}
