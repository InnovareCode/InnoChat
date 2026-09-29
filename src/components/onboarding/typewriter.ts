/**
 * Máquina de escrever do Inno — reducer puro (sem timers, sem React), testado à parte.
 * Fases: `dots` ("Inno está digitando…") → `typing` (letra a letra) → `done`.
 * `complete` (clique/tecla) pula direto para `done` com o texto inteiro; `reduced`
 * (prefers-reduced-motion) já nasce em `done`.
 */
import type { SpeechPhase } from "./inno-face";

export const MS_PER_CHAR = 28;
export const DOTS_MIN_MS = 600;
export const DOTS_MAX_MS = 900;

export type TypewriterState = { phase: SpeechPhase; count: number; total: number };

/** Duração do "digitando…": 600 ms para falas curtas até 900 ms para as longas (≥120 caracteres). */
export function dotsDuration(textLength: number): number {
  const ratio = Math.min(Math.max(textLength, 0), 120) / 120;
  return Math.round(DOTS_MIN_MS + ratio * (DOTS_MAX_MS - DOTS_MIN_MS));
}

export function initTypewriter(text: string, reduced: boolean): TypewriterState {
  const total = Array.from(text).length;
  return reduced || total === 0 ? { phase: "done", count: total, total } : { phase: "dots", count: 0, total };
}

export type TypewriterAction = { type: "start" } | { type: "tick" } | { type: "complete" } | { type: "reset"; text: string; reduced: boolean };

export function typewriterReducer(state: TypewriterState, action: TypewriterAction): TypewriterState {
  switch (action.type) {
    case "start":
      return state.phase === "dots" ? { ...state, phase: "typing", count: 0 } : state;
    case "tick": {
      if (state.phase !== "typing") return state;
      const count = Math.min(state.count + 1, state.total);
      return { ...state, count, phase: count >= state.total ? "done" : "typing" };
    }
    case "complete":
      return state.phase === "done" ? state : { ...state, phase: "done", count: state.total };
    case "reset":
      return initTypewriter(action.text, action.reduced);
  }
}

/** Trecho visível (por pontos de código, para não quebrar emoji ao meio). */
export function visibleText(text: string, count: number): string {
  return Array.from(text).slice(0, count).join("");
}
