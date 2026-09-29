import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHECKLIST_STEPS, TOUR_STEPS } from "./inno-script";
import { TourBalloon } from "./tour-balloon";
import { computePlacement, padRect } from "./tour-geometry";
import { bodyFor, goBack, goNext, keyToAction, nextFocusIndex, stepsForViewport, targetFor } from "./tour-logic";

const desktop = stepsForViewport(TOUR_STEPS, true);
const mobile = stepsForViewport(TOUR_STEPS, false);

describe("passos do tour", () => {
  it("começa com boas-vindas, termina com fechamento e ids são únicos", () => {
    expect(TOUR_STEPS[0].kind).toBe("welcome");
    expect(TOUR_STEPS.at(-1)?.kind).toBe("finish");
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
  });

  it("no celular some só o que é da sidebar fixa; menu aponta para o botão", () => {
    expect(mobile.length).toBeLessThan(desktop.length);
    expect(mobile.every((s) => !s.desktopOnly)).toBe(true);
    const menu = TOUR_STEPS.find((s) => s.id === "menu")!;
    expect(targetFor(menu, true)).toBe("sidebar");
    expect(targetFor(menu, false)).toBe("menu-button");
    expect(bodyFor(menu, false)).not.toBe(bodyFor(menu, true));
  });

  it("checklist tem os 5 passos do contrato, na ordem", () => {
    expect(CHECKLIST_STEPS.map((s) => s.key)).toEqual(["services", "professionals", "hours", "whatsapp", "botTest"]);
  });
});

describe("navegação", () => {
  it("próximo avança e, no último passo, conclui", () => {
    expect(goNext(0, 5)).toEqual({ index: 1, done: false });
    expect(goNext(4, 5)).toEqual({ index: 4, done: true });
  });
  it("voltar não passa do primeiro", () => {
    expect(goBack(3)).toEqual({ index: 2, done: false });
    expect(goBack(0)).toEqual({ index: 0, done: false });
  });
});

describe("teclado", () => {
  it("setas navegam, Esc pula", () => {
    expect(keyToAction({ key: "ArrowRight" })).toBe("next");
    expect(keyToAction({ key: "ArrowLeft" })).toBe("back");
    expect(keyToAction({ key: "Escape" })).toBe("skip");
    expect(keyToAction({ key: "a" })).toBeNull();
  });
  it("Ctrl/Cmd+K é bloqueado; outras combinações com modificador passam", () => {
    expect(keyToAction({ key: "k", ctrlKey: true })).toBe("block");
    expect(keyToAction({ key: "K", metaKey: true })).toBe("block");
    expect(keyToAction({ key: "ArrowRight", altKey: true })).toBeNull();
  });
  it("foco preso: dá a volta nas duas pontas", () => {
    expect(nextFocusIndex(2, 3, false)).toBe(0);
    expect(nextFocusIndex(0, 3, true)).toBe(2);
    expect(nextFocusIndex(-1, 3, false)).toBe(0);
    expect(nextFocusIndex(-1, 3, true)).toBe(2);
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
  });
});

describe("posição do balão", () => {
  const viewport = { width: 1440, height: 900 };
  const balloon = { width: 360, height: 200 };

  it("sem alvo, centraliza", () => {
    expect(computePlacement({ target: null, balloon, viewport })).toEqual({ mode: "center" });
  });
  it("alvo na sidebar: balão à direita, alinhado ao centro do alvo e dentro da tela", () => {
    const target = padRect({ top: 300, left: 16, width: 224, height: 40 }, 6);
    const p = computePlacement({ target, balloon, viewport });
    expect(p).toMatchObject({ mode: "anchored", side: "right" });
    if (p.mode !== "anchored") return;
    expect(p.left).toBeGreaterThanOrEqual(target.left + target.width);
    expect(p.top).toBeGreaterThanOrEqual(12);
    expect(p.top + balloon.height).toBeLessThanOrEqual(viewport.height - 12);
  });
  it("alvo na topbar à direita: cai para baixo e não vaza pela borda", () => {
    const target = { top: 12, left: 1300, width: 120, height: 32 };
    const p = computePlacement({ target, balloon, viewport });
    expect(p).toMatchObject({ mode: "anchored", side: "bottom" });
    if (p.mode !== "anchored") return;
    expect(p.left + balloon.width).toBeLessThanOrEqual(viewport.width - 12);
  });
  it("alvo que ocupa a tela toda não deixa lado livre: centraliza", () => {
    const target = { top: 0, left: 0, width: 1440, height: 900 };
    expect(computePlacement({ target, balloon, viewport })).toEqual({ mode: "center" });
  });
});

describe("balão renderizado", () => {
  const noop = () => undefined;
  const html = (position: number, total: number, stepIndex: number) =>
    renderToStaticMarkup(
      createElement(TourBalloon, {
        step: TOUR_STEPS[stepIndex],
        body: TOUR_STEPS[stepIndex].body,
        position,
        total,
        layout: { kind: "center" },
        onNext: noop,
        onBack: noop,
        onSkip: noop,
      }),
    );

  it("mostra indicador, região aria-live, Voltar/Próximo/Pular num passo do meio", () => {
    const out = html(3, 10, 3);
    expect(out).toContain("3 de 10");
    expect(out).toContain('aria-live="polite"');
    expect(out).toContain('role="dialog"');
    expect(out).toContain("Próximo");
    expect(out).toContain("Voltar");
    expect(out).toContain("Pular tour");
  });
  it("primeiro passo não tem Voltar e o botão principal é 'Vamos lá'", () => {
    const out = html(1, 10, 0);
    expect(out).not.toContain("Voltar");
    expect(out).toContain("Vamos lá");
    expect(out).toContain("Oi! Eu sou o Inno");
  });
  it("último passo troca Próximo por Concluir e some o Pular", () => {
    const out = html(10, 10, TOUR_STEPS.length - 1);
    expect(out).toContain("Concluir");
    expect(out).not.toContain("Pular tour");
  });
});

describe("posição do balão com alvo maior que a tela", () => {
  it("sidebar numa página longa: balão fica dentro da parte visível, centrado nela", () => {
    const viewport = { width: 1440, height: 900 };
    const balloon = { width: 360, height: 200 };
    const p = computePlacement({ target: { top: -6, left: -6, width: 268, height: 1382 }, balloon, viewport });
    expect(p).toMatchObject({ mode: "anchored", side: "right" });
    if (p.mode !== "anchored") return;
    expect(p.top).toBe(350);
  });
});
