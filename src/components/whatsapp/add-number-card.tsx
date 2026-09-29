"use client";

import { PhoneFrame, PhoneScale, GhostScreen } from "./phone-mockup";

/**
 * Card "Adicionar número": mesmo formato dos cards de instância, com o celular pontilhado
 * (fantasma). É um botão inteiro (alvo grande) que abre o mesmo diálogo de conexão. O nome
 * acessível é "Adicionar número" (não pode conter "Conectar número": o E2E busca esse botão do
 * cabeçalho pelo nome e exige um único resultado).
 */
export function AddNumberCard({
  onClick,
  disabled,
  disabledHint,
}: {
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      className="group flex min-h-[44px] flex-col items-center justify-center gap-4 rounded-hero border-2 border-dashed border-border bg-transparent px-4 py-6 text-center transition-[border-color,background-color] duration-200 hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
    >
      <PhoneScale compact>
        <PhoneFrame ghost className="transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none">
          <GhostScreen />
        </PhoneFrame>
      </PhoneScale>
      <span className="font-display text-base font-bold text-text">Adicionar número</span>
      <span className="-mt-2 max-w-[16rem] text-sm text-text-secondary">Conecte outro WhatsApp com um QR code.</span>
    </button>
  );
}
