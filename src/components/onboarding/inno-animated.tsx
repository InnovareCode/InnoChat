"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { motion, useAnimationControls } from "framer-motion";
import { cn } from "@/components/lib/cn";
import { MASCOT_NAME } from "./inno-script";
import {
  BLINK_DURATION_MS,
  FACE_GEOMETRY,
  LED,
  MOUTH_TICK_MS,
  effectiveExpression,
  mouthPath,
  nextBlinkDelay,
  resolveFace,
  type FaceGeometry,
  type InnoExpression,
} from "./inno-face";
import { usePrefersReducedMotion } from "./use-inno-speech";

export type InnoAnimatedProps = {
  /** Largura em px do corpo inteiro / diâmetro do avatar. Omita no corpo inteiro para dimensionar por `className` (ex.: `w-24`). */
  size?: number;
  expression?: InnoExpression;
  /** `true` enquanto o Inno "fala": a boca alterna e ele inclina de leve ao começar. */
  talking?: boolean;
  /** `avatar` = busto redondo (192×192); `full` = corpo inteiro (373×669). */
  variant?: "avatar" | "full";
  className?: string;
  priority?: boolean;
  /** Só o piscar/respiração, sem o rosto de LED redesenhado (rosto original do PNG). */
  plain?: boolean;
};

/** Abaixo disto o rosto sobreposto vira ruído (olhos < 4 px): fica o PNG original + respiração. */
export const MIN_FACE_SIZE = 40;

function FaceOverlay({
  geo,
  expression,
  talking,
  reduced,
}: {
  geo: FaceGeometry;
  expression: InnoExpression;
  talking: boolean;
  reduced: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const [blinking, setBlinking] = useState(false);
  const [tick, setTick] = useState(0);

  // Piscar: a cada 3–6 s, aleatório. Desligado com movimento reduzido.
  useEffect(() => {
    if (reduced) return;
    let t1 = 0;
    let t2 = 0;
    const schedule = () => {
      t1 = window.setTimeout(() => {
        setBlinking(true);
        t2 = window.setTimeout(() => {
          setBlinking(false);
          schedule();
        }, BLINK_DURATION_MS);
      }, nextBlinkDelay(Math.random()));
    };
    schedule();
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [reduced]);

  // Boca "falando": avança o ciclo enquanto `talking`.
  useEffect(() => {
    if (!talking || reduced) return;
    const id = window.setInterval(() => setTick((n) => n + 1), MOUTH_TICK_MS);
    return () => window.clearInterval(id);
  }, [talking, reduced]);

  const face = resolveFace(expression, talking && !reduced, tick);
  const r = geo.eyeRadius;
  const glow = Math.max(r * 0.2, 0.9);
  const dot = r * 0.3;
  const m = geo.mouth;
  const eyes = [geo.eyeLeft, geo.eyeRight];
  const showArc = face.eyes === "arc";
  const fade = reduced ? "none" : "opacity 120ms ease-out";

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      data-inno-face=""
      data-expression={effectiveExpression(expression, talking)}
      data-mouth={face.mouth}
      viewBox={`0 0 ${geo.width} ${geo.height}`}
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <radialGradient id={`${uid}-cover`}>
          <stop offset="0" stopColor={LED.screen} />
          <stop offset="0.85" stopColor={LED.screen} />
          <stop offset="1" stopColor={LED.screen} stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={glow} />
        </filter>
        <pattern id={`${uid}-dots`} patternUnits="userSpaceOnUse" width={dot} height={dot}>
          <circle cx={dot / 2} cy={dot / 2} r={dot * 0.28} fill="#04252b" opacity="0.28" />
        </pattern>
      </defs>

      {/* Tapa-buraco: a tela escura cobre olhos e boca originais do PNG, para não duplicar. */}
      {eyes.map((e, i) => (
        <circle key={`c${i}`} cx={e.x} cy={e.y} r={r + geo.coverPad} fill={`url(#${uid}-cover)`} />
      ))}
      <ellipse cx={m.x} cy={m.y - 0.4} rx={geo.mouthCover.rx} ry={geo.mouthCover.ry} transform={`rotate(${geo.tilt} ${m.x} ${m.y})`} fill={`url(#${uid}-cover)`} />

      {/* Olhos */}
      {eyes.map((e, i) => (
        <g key={`e${i}`} transform={`translate(${e.x + face.eyeShift.x * r} ${e.y + face.eyeShift.y * r}) rotate(${geo.tilt})`}>
          <g
            style={{
              transform: blinking ? "scaleY(0.08)" : "scaleY(1)",
              transformBox: "fill-box",
              transformOrigin: "center",
              transition: reduced ? "none" : `transform ${BLINK_DURATION_MS / 2}ms ease-in-out`,
            }}
          >
            <g style={{ opacity: showArc ? 0 : 1, transition: fade }}>
              <circle r={r * 0.95} fill={LED.glow} opacity="0.75" filter={`url(#${uid}-glow)`} />
              <circle r={r} fill={LED.base} />
              <circle r={r} fill={`url(#${uid}-dots)`} />
              <circle cx={-r * 0.3} cy={-r * 0.35} r={r * 0.38} fill={LED.bright} opacity="0.55" />
            </g>
            <g style={{ opacity: showArc ? 1 : 0, transition: fade }}>
              <path
                d={`M ${-r * 0.95} ${r * 0.35} Q 0 ${-r * 1.15} ${r * 0.95} ${r * 0.35}`}
                fill="none"
                stroke={LED.glow}
                strokeWidth={r * 0.55}
                strokeLinecap="round"
                opacity="0.7"
                filter={`url(#${uid}-glow)`}
              />
              <path
                d={`M ${-r * 0.95} ${r * 0.35} Q 0 ${-r * 1.15} ${r * 0.95} ${r * 0.35}`}
                fill="none"
                stroke={LED.base}
                strokeWidth={r * 0.42}
                strokeLinecap="round"
              />
            </g>
          </g>
        </g>
      ))}

      {/* Boca (formato normalizado: metade da largura = 1) */}
      <g transform={`translate(${m.x} ${m.y}) rotate(${geo.tilt}) scale(${m.halfWidth})`}>
        <motion.path
          d={mouthPath(face.mouth)}
          initial={false}
          animate={{ d: mouthPath(face.mouth) }}
          transition={{ duration: reduced ? 0 : 0.09, ease: "easeOut" }}
          fill={LED.glow}
          stroke={LED.glow}
          strokeWidth={0.34}
          strokeLinejoin="round"
          opacity="0.55"
          filter={`url(#${uid}-glow)`}
        />
        <motion.path
          d={mouthPath(face.mouth)}
          initial={false}
          animate={{ d: mouthPath(face.mouth) }}
          transition={{ duration: reduced ? 0 : 0.09, ease: "easeOut" }}
          fill={LED.base}
          stroke={LED.base}
          strokeWidth={0.05}
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

/**
 * Inno animado — componente único do mascote (tour, checklist, parabéns, sino, conversa vazia).
 * Camadas: corpo (respiração em CSS, `.inno-breathe`) → movimento pontual (inclinação ao começar a
 * falar, pulinho ao ficar feliz) → PNG + SVG do rosto de LED por cima, alinhado ao pixel.
 * Com `prefers-reduced-motion`: sem respiração, inclinação, pulo, piscar nem boca falando; a
 * expressão estática continua valendo.
 */
export function InnoAnimated({
  size,
  expression = "neutral",
  talking = false,
  variant = "full",
  className,
  priority,
  plain = false,
}: InnoAnimatedProps) {
  const reduced = usePrefersReducedMotion();
  const controls = useAnimationControls();
  const wasTalking = useRef(false);
  const lastExpression = useRef<InnoExpression>(expression);
  const isAvatar = variant === "avatar";
  const geo = FACE_GEOMETRY[isAvatar ? "avatar" : "full"];
  const pxSize = size ?? (isAvatar ? 44 : 96);
  const showFace = !plain && pxSize >= MIN_FACE_SIZE;

  // Inclinação de ~3° a cada fala nova (subida de `talking`); pulinho quando fica feliz.
  useEffect(() => {
    if (reduced) {
      wasTalking.current = talking;
      lastExpression.current = expression;
      return;
    }
    if (talking && !wasTalking.current) {
      void controls.start({ rotate: [0, isAvatar ? 2 : 3, 0], transition: { duration: 0.9, ease: "easeInOut" } });
    }
    if (expression === "happy" && lastExpression.current !== "happy") {
      void controls.start(
        isAvatar
          ? { scale: [1, 1.07, 1], transition: { duration: 0.5, ease: "easeOut" } }
          : { y: [0, -9, 0, -3, 0], transition: { duration: 0.7, ease: "easeOut", times: [0, 0.35, 0.65, 0.82, 1] } },
      );
    }
    wasTalking.current = talking;
    lastExpression.current = expression;
  }, [talking, expression, reduced, controls, isAvatar]);

  const inner = (
    <motion.div
      animate={controls}
      className={isAvatar ? "absolute inset-0" : "relative"}
      style={{ transformOrigin: isAvatar ? "50% 50%" : "50% 92%" }}
    >
      {isAvatar ? (
        <Image
          src="/mascote/inno-avatar.webp"
          alt=""
          width={192}
          height={192}
          sizes={`${pxSize}px`}
          className="h-full w-full object-cover"
          priority={priority}
        />
      ) : (
        <Image
          src="/mascote/inno.png"
          alt={`${MASCOT_NAME}, o mascote do InnoChat, um robô azul e branco com headset`}
          width={373}
          height={669}
          sizes={size ? `${size}px` : "(max-width: 640px) 120px, 180px"}
          priority={priority}
          className="block h-auto w-full select-none"
          draggable={false}
        />
      )}
      {showFace ? <FaceOverlay geo={geo} expression={expression} talking={talking} reduced={reduced} /> : null}
    </motion.div>
  );

  if (isAvatar) {
    return (
      <span
        data-inno-animated="avatar"
        className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/20", className)}
        style={{ width: pxSize, height: pxSize }}
      >
        <span className="inno-breathe-avatar absolute inset-0">{inner}</span>
      </span>
    );
  }

  return (
    <span
      data-inno-animated="full"
      className={cn("inline-block shrink-0", className)}
      style={size ? { width: size } : undefined}
    >
      <span className="inno-breathe block">{inner}</span>
    </span>
  );
}
