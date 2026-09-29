import { Calendar, MessageCircle, ShieldCheck } from "lucide-react";

/**
 * Casca visual das telas públicas (login, cadastro, recuperação de senha, convite, instalação —
 * docs/design/screens/premium/onda2). Painel dividido no desktop: lado de apresentação do
 * InnoChat (gradiente do tema Índigo — fixo nas públicas, `(public)/layout.tsx` já define
 * `data-theme="INDIGO_CLINICO"`) + formulário do outro lado. No celular, só o formulário com um
 * cabeçalho de marca compacto — o painel de apresentação não cabe e não é essencial ali.
 *
 * Puro CSS (sem estado/motion), então fica Server Component — cada página só embrulha o próprio
 * formulário (que continua Client Component) com isto por fora.
 */

const BENEFITS = [
  {
    icon: Calendar,
    title: "Agenda sem fricção",
    description: "Serviços, profissionais e horários organizados num só painel.",
  },
  {
    icon: MessageCircle,
    title: "Atendimento pelo WhatsApp",
    description: "O bot agenda, remarca e cancela pelo número que sua empresa já usa.",
  },
  {
    icon: ShieldCheck,
    title: "Cada empresa isolada",
    description: "Dados, conversas e agenda de cada cliente ficam só com ele.",
  },
];

export function PublicSplitLayout({
  children,
  formMaxWidth = "max-w-sm",
}: {
  children: React.ReactNode;
  /** Largura do card de formulário do lado direito — cadastro/instalação têm mais campos que login. */
  formMaxWidth?: "max-w-sm" | "max-w-md";
}) {
  return (
    <main className="flex min-h-screen">
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-gradient-to-br from-primary to-primary-strong p-10 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_20%_20%,color-mix(in_oklab,white_35%,transparent),transparent_55%),radial-gradient(circle_at_85%_75%,color-mix(in_oklab,white_18%,transparent),transparent_55%)]"
          aria-hidden="true"
        />
        <div className="relative">
          <span className="font-display text-xl font-black tracking-tight text-white">InnoChat</span>
        </div>
        <div className="relative flex flex-col gap-6">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25">
                <benefit.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="font-display text-sm font-bold text-white">{benefit.title}</p>
                <p className="mt-0.5 text-sm text-white/75">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="relative text-xs text-white/60">Agenda e atendimento no WhatsApp, num painel só.</p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className={`w-full ${formMaxWidth}`}>
          <div className="mb-6 text-center lg:hidden">
            <span className="font-display text-lg font-black text-text">InnoChat</span>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
