import { createElement } from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { tenantNavItems } from "@/components/shell/nav-items";
import {
  BLINK_MAX_MS,
  BLINK_MIN_MS,
  TALK_CYCLE,
  effectiveExpression,
  expressionForPhase,
  mouthPath,
  nextBlinkDelay,
  resolveFace,
} from "./inno-face";
import { CHECKLIST_OPTIONAL_TIP, CHECKLIST_STEPS, TOUR_STEPS } from "./inno-script";
import { InnoSpeechText } from "./inno-speech-text";
import { stepsForViewport } from "./tour-logic";
import { DOTS_MAX_MS, DOTS_MIN_MS, MS_PER_CHAR, dotsDuration, initTypewriter, typewriterReducer, visibleText } from "./typewriter";

describe("máquina de escrever", () => {
  const text = "Oi! Eu sou o Inno 👋";

  it("velocidade fica entre 25 e 35 ms por caractere e o digitando… entre 600 e 900 ms", () => {
    expect(MS_PER_CHAR).toBeGreaterThanOrEqual(25);
    expect(MS_PER_CHAR).toBeLessThanOrEqual(35);
    expect(dotsDuration(0)).toBe(DOTS_MIN_MS);
    expect(dotsDuration(500)).toBe(DOTS_MAX_MS);
    expect(dotsDuration(60)).toBeGreaterThan(DOTS_MIN_MS);
    expect(dotsDuration(60)).toBeLessThan(DOTS_MAX_MS);
  });

  it("começa em 'digitando…', depois digita letra a letra até terminar", () => {
    let s = initTypewriter("abc", false);
    expect(s).toEqual({ phase: "dots", count: 0, total: 3 });
    s = typewriterReducer(s, { type: "tick" }); // tick fora da fase typing é ignorado
    expect(s.count).toBe(0);
    s = typewriterReducer(s, { type: "start" });
    expect(s.phase).toBe("typing");
    s = typewriterReducer(s, { type: "tick" });
    expect(visibleText("abc", s.count)).toBe("a");
    s = typewriterReducer(s, { type: "tick" });
    s = typewriterReducer(s, { type: "tick" });
    expect(s).toEqual({ phase: "done", count: 3, total: 3 });
  });

  it("clique/tecla (complete) mostra o texto inteiro na hora, em qualquer fase", () => {
    const dots = typewriterReducer(initTypewriter(text, false), { type: "complete" });
    expect(dots.phase).toBe("done");
    expect(visibleText(text, dots.count)).toBe(text);

    let mid = typewriterReducer(initTypewriter(text, false), { type: "start" });
    mid = typewriterReducer(mid, { type: "tick" });
    mid = typewriterReducer(mid, { type: "complete" });
    expect(mid.phase).toBe("done");
    expect(visibleText(text, mid.count)).toBe(text);
  });

  it("prefers-reduced-motion: o texto já nasce completo, sem digitar", () => {
    const s = initTypewriter(text, true);
    expect(s.phase).toBe("done");
    expect(visibleText(text, s.count)).toBe(text);
  });

  it("não quebra emoji ao meio", () => {
    expect(visibleText("a👋b", 2)).toBe("a👋");
  });

  it("reset reinicia para outra fala", () => {
    const done = typewriterReducer(initTypewriter("abc", false), { type: "complete" });
    expect(typewriterReducer(done, { type: "reset", text: "xy", reduced: false })).toEqual({ phase: "dots", count: 0, total: 2 });
  });
});

describe("texto da fala (acessibilidade)", () => {
  it("o texto final está no DOM para leitor de tela desde o início; a animação é aria-hidden", () => {
    const html = renderToStaticMarkup(
      createElement(InnoSpeechText, { text: "Fala completa do Inno", speech: { phase: "dots", visible: "", complete: () => undefined } }),
    );
    expect(html).toContain('<p class="sr-only">Fala completa do Inno</p>');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("data-inno-typing");
  });
  it("sem animação (done) não há pontinhos", () => {
    const html = renderToStaticMarkup(
      createElement(InnoSpeechText, { text: "Oi", speech: { phase: "done", visible: "Oi", complete: () => undefined } }),
    );
    expect(html).not.toContain("data-inno-typing");
  });
});

describe("expressões do Inno", () => {
  it("sequência da fala: pensando, falando, parado; comemoração fica feliz", () => {
    expect(expressionForPhase("dots")).toEqual({ expression: "thinking", talking: false });
    expect(expressionForPhase("typing")).toEqual({ expression: "neutral", talking: true });
    expect(expressionForPhase("done")).toEqual({ expression: "neutral", talking: false });
    expect(expressionForPhase("typing", "happy")).toEqual({ expression: "happy", talking: true });
    expect(expressionForPhase("done", "happy")).toEqual({ expression: "happy", talking: false });
  });

  it("as 4 expressões têm rostos distintos", () => {
    expect(resolveFace("neutral", false, 0)).toMatchObject({ eyes: "round", mouth: "smile" });
    expect(resolveFace("happy", false, 0)).toMatchObject({ eyes: "arc", mouth: "grin" });
    const thinking = resolveFace("thinking", false, 0);
    expect(thinking.eyeShift.y).toBeLessThan(0); // olhos para cima
    expect(thinking.mouth).toBe("flat");
    expect(effectiveExpression("neutral", true)).toBe("talking");
    expect(effectiveExpression("happy", true)).toBe("happy");
  });

  it("falando, a boca alterna entre sorriso e boca aberta/oval e é cíclica", () => {
    const mouths = TALK_CYCLE.map((_, i) => resolveFace("neutral", true, i).mouth);
    expect(new Set(mouths)).toEqual(new Set(["smile", "open", "oval"]));
    expect(resolveFace("neutral", true, TALK_CYCLE.length).mouth).toBe(mouths[0]);
    expect(resolveFace("neutral", true, -1).mouth).toBe(mouths.at(-1));
  });

  it("todas as bocas têm a mesma estrutura de curvas (o framer interpola o d)", () => {
    const shapes = ["smile", "open", "oval", "flat", "grin", "grinOpen"] as const;
    const skeleton = (d: string) => d.replace(/-?\d+(\.\d+)?/g, "N");
    const first = skeleton(mouthPath(shapes[0]));
    shapes.forEach((s) => expect(skeleton(mouthPath(s))).toBe(first));
  });

  it("piscar a cada 3–6 s, com intervalo aleatório", () => {
    expect(nextBlinkDelay(0)).toBe(BLINK_MIN_MS);
    expect(nextBlinkDelay(1)).toBeLessThanOrEqual(BLINK_MAX_MS);
    expect(nextBlinkDelay(0.5)).toBe(4500);
  });
});

describe("conteúdo do tour revisado", () => {
  const desktop = stepsForViewport(TOUR_STEPS, true);
  const mobile = stepsForViewport(TOUR_STEPS, false);

  it("desktop tem no máximo 16 passos e celular poucos (até 7)", () => {
    expect(desktop.length).toBeLessThanOrEqual(16);
    expect(mobile.length).toBeLessThanOrEqual(7);
  });

  it("cobre as novidades: sino, minha conta, conversa, ações do agendamento, lembrete, plano", () => {
    const all = TOUR_STEPS.map((s) => `${s.title} ${s.body}`).join(" ");
    expect(TOUR_STEPS.some((s) => s.target === "topbar-notifications")).toBe(true);
    expect(TOUR_STEPS.some((s) => s.target === "user-block")).toBe(true);
    expect(all).toMatch(/aba Conversa/);
    expect(all).toMatch(/90 dias/);
    expect(all).toMatch(/concluir o atendimento/);
    expect(all).toMatch(/faltou/);
    expect(all).toMatch(/remarcar/);
    expect(all).toMatch(/lembrete automático/);
    expect(all).toMatch(/limite do plano/);
    expect(all).toMatch(/bom dia/);
  });

  it("todo alvo `data-tour` existe no painel (nav pelos itens reais, o resto no código)", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".tsx")) files.push(p);
      }
    };
    walk(join(process.cwd(), "src"));
    const source = files.map((f) => readFileSync(f, "utf-8")).join("\n");
    const navTargets = new Set(tenantNavItems("acme").map((i) => `nav-${i.href.split("/").pop()}`));
    for (const s of TOUR_STEPS) {
      for (const t of [s.target, s.targetMobile]) {
        if (!t) continue;
        if (t.startsWith("nav-")) expect(navTargets.has(t), t).toBe(true);
        else expect(source, `data-tour="${t}"`).toContain(`data-tour="${t}"`);
      }
    }
  });

  it("a dica opcional do lembrete não entra no contrato nem no progresso", () => {
    expect(CHECKLIST_STEPS).toHaveLength(5);
    expect(CHECKLIST_STEPS.map((s) => s.title).join(" ")).not.toMatch(/lembrete/i);
    expect(CHECKLIST_OPTIONAL_TIP.title).toMatch(/lembrete automático/);
  });
});
