import { cn } from "@/components/lib/cn";

/**
 * Matiz fixo por posição — combinado com `color-mix(in oklab, var(--color-primary) ...)` (ver
 * `colorForId`) para dar uma paleta HARMÔNICA com o tema ativo (nunca hex cru direto na tela):
 * a cor final sempre carrega uma fração da cor primária do tema, só a distinção entre pessoas
 * vem do matiz fixo. Repetida em `professionalColor()` (agenda) para a MESMA pessoa ter sempre a
 * mesma cor nos dois lugares (avatar e bloco da agenda).
 */
const AVATAR_HUES = ["#f97316", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f43f5e", "#eab308", "#3b82f6"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/** Cor determinística por id (mesma pessoa = mesma cor sempre) — 55% da cor primária do tema
 * misturada com um matiz fixo, para nunca destoar da paleta do tenant. */
export function colorForId(id: string): string {
  const hue = AVATAR_HUES[hashString(id) % AVATAR_HUES.length];
  return `color-mix(in oklab, var(--color-primary) 55%, ${hue})`;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  id,
  name,
  size = "md",
  className,
}: {
  id: string;
  name: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs",
        className,
      )}
      style={{ backgroundColor: colorForId(id) }}
      aria-hidden="true"
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}
