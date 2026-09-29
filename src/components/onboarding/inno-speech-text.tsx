import { cn } from "@/components/lib/cn";
import type { InnoSpeech } from "./use-inno-speech";

/**
 * Texto da fala do Inno. O texto FINAL fica sempre no DOM para leitores de tela (`sr-only`); o que
 * se vê é só animação (`aria-hidden`): o trecho já digitado + o resto transparente (reserva a
 * altura exata, então o balão não "cresce" enquanto digita) e, antes de começar, os três pontinhos
 * de "Inno está digitando…". Clicar no texto completa a fala.
 */
export function InnoSpeechText({ text, speech, className }: { text: string; speech: InnoSpeech; className?: string }) {
  const typed = speech.visible;
  const rest = Array.from(text).slice(Array.from(typed).length).join("");
  const dots = speech.phase === "dots";
  return (
    <div className={cn("relative", speech.phase === "done" ? "" : "cursor-pointer", className)} onClick={speech.complete} data-inno-speech-phase={speech.phase}>
      <p className="sr-only">{text}</p>
      <p aria-hidden="true" className="text-sm leading-relaxed text-text-secondary">
        <span>{typed}</span>
        <span className="opacity-0">{rest}</span>
      </p>
      {dots ? (
        <span aria-hidden="true" data-inno-typing="" className="absolute left-0 top-0 flex h-[1.4rem] items-center gap-1.5">
          <span className="inno-dot h-2 w-2 rounded-full bg-primary/70" />
          <span className="inno-dot h-2 w-2 rounded-full bg-primary/70" style={{ animationDelay: "160ms" }} />
          <span className="inno-dot h-2 w-2 rounded-full bg-primary/70" style={{ animationDelay: "320ms" }} />
        </span>
      ) : null}
    </div>
  );
}
