import Image from "next/image";
import { cn } from "@/components/lib/cn";

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
