/** Geometria pura do balão do tour — separada do componente para poder ser testada sem DOM. */

export type Rect = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };
export type Side = "right" | "bottom" | "left" | "top";

export type Placement =
  | { mode: "center" }
  | { mode: "anchored"; side: Side; left: number; top: number; arrow: number };

const SIDES: Side[] = ["right", "bottom", "left", "top"];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Aumenta o retângulo do destaque (respiro em volta do elemento). */
export function padRect(rect: Rect, pad: number): Rect {
  return { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
}

function clipRect(rect: Rect, viewport: Size): Rect {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.left + rect.width, viewport.width);
  const bottom = Math.min(rect.top + rect.height, viewport.height);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * Escolhe o lado do alvo onde o balão cabe inteiro (ordem: direita, embaixo, esquerda, em cima) e
 * devolve a posição, já presa às bordas da tela, mais o deslocamento da "ponta" do balão (`arrow`,
 * em px a partir do canto do balão) para apontar para o centro do alvo. Sem lado que caiba (ou sem
 * alvo), o balão fica centralizado.
 */
export function computePlacement(opts: {
  target: Rect | null;
  balloon: Size;
  viewport: Size;
  gap?: number;
  margin?: number;
}): Placement {
  const { balloon, viewport } = opts;
  const gap = opts.gap ?? 16;
  const margin = opts.margin ?? 12;
  if (!opts.target) return { mode: "center" };
  // Alvo mais alto/largo que a tela (ex.: a sidebar numa página longa): usa só a parte visível
  // para posicionar o balão, senão ele cairia no meio de um retângulo que ninguém vê inteiro.
  const target = clipRect(opts.target, viewport);
  if (target.width <= 0 || target.height <= 0) return { mode: "center" };

  const cx = target.left + target.width / 2;
  const cy = target.top + target.height / 2;
  const arrowPad = 20;

  for (const side of SIDES) {
    if (side === "right" || side === "left") {
      const left = side === "right" ? target.left + target.width + gap : target.left - gap - balloon.width;
      if (left < margin || left + balloon.width > viewport.width - margin) continue;
      const top = clamp(cy - balloon.height / 2, margin, viewport.height - balloon.height - margin);
      return { mode: "anchored", side, left, top, arrow: clamp(cy - top, arrowPad, balloon.height - arrowPad) };
    }
    const top = side === "bottom" ? target.top + target.height + gap : target.top - gap - balloon.height;
    if (top < margin || top + balloon.height > viewport.height - margin) continue;
    const left = clamp(cx - balloon.width / 2, margin, viewport.width - balloon.width - margin);
    return { mode: "anchored", side, left, top, arrow: clamp(cx - left, arrowPad, balloon.width - arrowPad) };
  }
  return { mode: "center" };
}
