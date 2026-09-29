import Image from "next/image";
import { cn } from "@/components/lib/cn";
import { MASCOT_NAME } from "./inno-script";

/**
 * Avatar redondo do Inno (recorte do busto, 192×192 webp) — usado nos balões do tour e no card
 * do checklist. `size` em px; a imagem tem o dobro da resolução para telas retina.
 */
export function InnoAvatar({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/20",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/mascote/inno-avatar.webp"
        alt=""
        width={192}
        height={192}
        sizes={`${size}px`}
        className="h-full w-full object-cover"
      />
    </span>
  );
}

/**
 * Inno de corpo inteiro (373×669, PNG com transparência). A largura vem do contêiner (`className`
 * define a largura; a altura acompanha a proporção) — `sizes` limita o que o otimizador entrega.
 */
export function InnoFull({ className, priority }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/mascote/inno.png"
      alt={`${MASCOT_NAME}, o mascote do InnoChat, um robô azul e branco com headset acenando`}
      width={373}
      height={669}
      sizes="(max-width: 640px) 120px, 180px"
      priority={priority}
      className={cn("h-auto select-none", className)}
      draggable={false}
    />
  );
}
