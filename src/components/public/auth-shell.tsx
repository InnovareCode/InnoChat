import Image from "next/image";
import { CalendarCheck, BellRing, LayoutDashboard } from "lucide-react";

/**
 * Casca visual das telas de autenticação (login, cadastro, recuperar/redefinir senha, convite,
 * verificar e-mail, instalação). Server Component — só CSS, sem estado; cada página embrulha o
 * próprio formulário (Client Component) com isto por fora. Tema Índigo fixo nas públicas
 * (`(public)/layout.tsx`).
 *
 * - Desktop (>= lg): tela dividida. Painel de marca escuro (~48%) com a arte do Inno, título de
 *   valor e 3 benefícios; formulário em superfície clara do outro lado. O painel é `sticky` para
 *   continuar inteiro à vista enquanto o cadastro (longo) rola.
 * - Tablet/mobile: faixa de marca compacta no topo (recorte busto + wordmark da mesma arte) e o
 *   formulário logo abaixo — o login em 390x844 fica inteiro na primeira dobra.
 *
 * A arte foi desenhada para fundo escuro (o "Inno" do wordmark é branco, o contorno tem glow
 * azul); por isso sempre fica sobre `--panel-sidebar`, nunca sobre a superfície clara.
 * Arquivos gerados com sharp a partir de `public/marca/inno-logo.png` (1254x1254, 1,4 MB):
 * `inno-hero-960.webp` (~240 KB) e `inno-banner.webp` (recorte 1254x760, ~100 KB).
 */

const ART_ALT =
  "Inno, o robô mascote do InnoChat, de fone de ouvido, com a mão estendida como quem apresenta o sistema, ao lado do logotipo InnoChat";

const BENEFITS = [
  { icon: CalendarCheck, title: "Agenda automática", description: "O bot marca, remarca e cancela por você." },
  { icon: BellRing, title: "Lembretes e confirmações", description: "Menos faltas, sem mandar mensagem à mão." },
  { icon: LayoutDashboard, title: "Painel simples", description: "Tudo da sua agenda num só lugar." },
];

export function AuthShell({
  children,
  formMaxWidth = "max-w-sm",
}: {
  children: React.ReactNode;
  /** Largura do card de formulário — cadastro/instalação têm mais campos que login. */
  formMaxWidth?: "max-w-sm" | "max-w-md";
}) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[48fr_52fr]">
      {/* Painel de marca — desktop */}
      <aside className="auth-brand-bg relative hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:items-center lg:justify-center lg:gap-8 lg:px-12 lg:py-10">
        <div className="auth-rise auth-float">
          <Image
            src="/marca/inno-hero-960.webp"
            alt={ART_ALT}
            width={960}
            height={960}
            priority
            unoptimized
            className="aspect-square h-[min(50vh,32rem)] w-auto select-none"
          />
        </div>
        <div className="auth-rise max-w-lg text-center" style={{ "--auth-delay": "80ms" } as React.CSSProperties}>
          <p className="font-display text-3xl font-extrabold leading-tight tracking-tight text-sidebar-active-text xl:text-4xl">
            Seu WhatsApp agendando sozinho, 24h por dia
          </p>
        </div>
        <ul
          className="auth-rise grid w-full max-w-xl grid-cols-3 gap-4"
          style={{ "--auth-delay": "160ms" } as React.CSSProperties}
        >
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sidebar-active-text ring-1 ring-white/20">
                <benefit.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="font-display text-sm font-bold text-sidebar-active-text">{benefit.title}</span>
              <span className="text-xs leading-snug text-sidebar-text">{benefit.description}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* Faixa de marca — tablet/mobile */}
      <header className="auth-brand-bg-compact flex justify-center bg-sidebar px-4 pt-4 pb-2 lg:hidden">
        <Image
          src="/marca/inno-banner.webp"
          alt={ART_ALT}
          width={720}
          height={436}
          unoptimized
          className="auth-rise h-[7.5rem] w-auto select-none md:h-40"
        />
      </header>

      <section className="flex flex-col items-center bg-bg px-4 py-6 sm:px-6 lg:min-h-screen lg:justify-center lg:py-12">
        <div className={`w-full ${formMaxWidth}`}>{children}</div>
      </section>
    </main>
  );
}
