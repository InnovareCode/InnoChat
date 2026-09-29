/**
 * Rosto de LED do Inno — dados e regras puras (sem React), para o SVG de `inno-animated.tsx` e
 * para os testes. Coordenadas MEDIDAS nos PNG/WebP reais (componentes conexos dos pixels ciano):
 * a tela do rosto é inclinada ~-7,5° (o olho direito fica mais alto), então tudo gira junto.
 */

export type InnoExpression = "neutral" | "talking" | "happy" | "thinking";
export type EyeStyle = "round" | "arc";
export type MouthShape = "smile" | "open" | "oval" | "flat" | "grin" | "grinOpen";

/** Fase da fala: "digitando…" (dots) → texto saindo (typing) → parado (done). */
export type SpeechPhase = "dots" | "typing" | "done";

export type FaceGeometry = {
  /** Tamanho do desenho de origem (o SVG usa como viewBox). */
  width: number;
  height: number;
  eyeLeft: { x: number; y: number };
  eyeRight: { x: number; y: number };
  eyeRadius: number;
  mouth: { x: number; y: number; halfWidth: number };
  /** Inclinação da tela em graus. */
  tilt: number;
  /** Folga do "tapa-buraco" escuro que cobre os olhos/boca originais do PNG. */
  coverPad: number;
  mouthCover: { rx: number; ry: number };
};

export const FACE_GEOMETRY: Record<"full" | "avatar", FaceGeometry> = {
  // public/mascote/inno.png (373×669)
  full: {
    width: 373,
    height: 669,
    eyeLeft: { x: 148.4, y: 203.8 },
    eyeRight: { x: 209.2, y: 195.8 },
    eyeRadius: 11.5,
    mouth: { x: 183.1, y: 231.7, halfWidth: 17.5 },
    tilt: -7.5,
    coverPad: 4,
    mouthCover: { rx: 25, ry: 11.5 },
  },
  // public/mascote/inno-avatar.webp (192×192)
  avatar: {
    width: 192,
    height: 192,
    eyeLeft: { x: 58.4, y: 98.3 },
    eyeRight: { x: 98.8, y: 93.0 },
    eyeRadius: 7.6,
    mouth: { x: 81.4, y: 116.8, halfWidth: 11.5 },
    tilt: -7.5,
    coverPad: 3.2,
    mouthCover: { rx: 16.5, ry: 7.5 },
  },
};

/** Cor do LED (média medida nos olhos) e da tela (fundo sob os olhos). */
export const LED = { base: "#5be3f0", bright: "#a5f6fc", glow: "#22d3ee", screen: "#10161a" } as const;

/**
 * Boca em coordenadas normalizadas (metade da largura = 1, centro = 0,0). Todas com a MESMA
 * estrutura de curvas, para o framer-motion interpolar o `d` de uma para a outra.
 */
type MouthParams = { x0: number; y0: number; tx: number; ct: number; bx: number; cb: number };

const MOUTH_PARAMS: Record<MouthShape, MouthParams> = {
  smile: { x0: -1, y0: -0.4, tx: 0.55, ct: 0.3, bx: 0.55, cb: 0.7 },
  open: { x0: -0.8, y0: -0.3, tx: 0.6, ct: 0.0, bx: 0.7, cb: 1.2 },
  oval: { x0: -0.5, y0: 0, tx: 0.75, ct: -0.2, bx: 0.75, cb: 0.8 },
  flat: { x0: -0.55, y0: 0, tx: 0.3, ct: 0.02, bx: 0.3, cb: 0.28 },
  grin: { x0: -1.1, y0: -0.5, tx: 0.6, ct: 0.35, bx: 0.6, cb: 0.98 },
  grinOpen: { x0: -1, y0: -0.45, tx: 0.72, ct: 0.15, bx: 0.72, cb: 1.55 },
};

export function mouthPath(shape: MouthShape): string {
  const p = MOUTH_PARAMS[shape];
  const f = (n: number) => Number(n.toFixed(3));
  return (
    `M ${f(p.x0)} ${f(p.y0)} C ${f(-p.tx)} ${f(p.ct)} ${f(p.tx)} ${f(p.ct)} ${f(-p.x0)} ${f(p.y0)} ` +
    `C ${f(p.bx)} ${f(p.cb)} ${f(-p.bx)} ${f(p.cb)} ${f(p.x0)} ${f(p.y0)} Z`
  );
}

/** Ciclo da boca enquanto fala: sutil, volta ao sorriso com frequência. */
export const TALK_CYCLE: readonly MouthShape[] = ["smile", "open", "oval", "open", "smile", "oval"];
export const TALK_CYCLE_HAPPY: readonly MouthShape[] = ["grin", "grinOpen", "grin", "grinOpen", "grin", "grinOpen"];
export const MOUTH_TICK_MS = 130;

export type FaceState = {
  eyes: EyeStyle;
  /** Deslocamento dos olhos em unidades de raio (thinking olha para cima). */
  eyeShift: { x: number; y: number };
  mouth: MouthShape;
};

/** Expressão efetiva: `talking` (prop) só muda o rosto quando a expressão base é neutra. */
export function effectiveExpression(expression: InnoExpression, talking: boolean): InnoExpression {
  return talking && expression === "neutral" ? "talking" : expression;
}

/** Rosto num instante `tick` (índice do ciclo da boca; só importa enquanto fala). */
export function resolveFace(expression: InnoExpression, talking: boolean, tick: number): FaceState {
  const exp = effectiveExpression(expression, talking);
  const idx = ((tick % TALK_CYCLE.length) + TALK_CYCLE.length) % TALK_CYCLE.length;
  switch (exp) {
    case "happy":
      return { eyes: "arc", eyeShift: { x: 0, y: 0 }, mouth: talking ? TALK_CYCLE_HAPPY[idx] : "grin" };
    case "thinking":
      return { eyes: "round", eyeShift: { x: 0.35, y: -0.55 }, mouth: "flat" };
    case "talking":
      return { eyes: "round", eyeShift: { x: 0, y: 0 }, mouth: TALK_CYCLE[idx] };
    default:
      return { eyes: "round", eyeShift: { x: 0, y: 0 }, mouth: "smile" };
  }
}

/** Piscar a cada 3–6 s: `rand` em [0,1). */
export const BLINK_MIN_MS = 3000;
export const BLINK_MAX_MS = 6000;
export const BLINK_DURATION_MS = 140;
export function nextBlinkDelay(rand: number): number {
  const r = Math.min(Math.max(rand, 0), 0.999999);
  return Math.round(BLINK_MIN_MS + r * (BLINK_MAX_MS - BLINK_MIN_MS));
}

/**
 * Expressão do Inno para cada fase da fala: "digitando…" = pensando; texto saindo = falando;
 * parado = neutro (ou feliz, quando a fala é de comemoração — `mood`).
 */
export function expressionForPhase(phase: SpeechPhase, mood: "neutral" | "happy" = "neutral"): { expression: InnoExpression; talking: boolean } {
  if (phase === "dots") return { expression: "thinking", talking: false };
  if (phase === "typing") return { expression: mood === "happy" ? "happy" : "neutral", talking: true };
  return { expression: mood === "happy" ? "happy" : "neutral", talking: false };
}
