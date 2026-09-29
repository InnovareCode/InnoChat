/**
 * Falas do Inno — ÚNICO arquivo de conteúdo do onboarding (tour guiado + checklist "Primeiros
 * passos"). O dono revisa/ajusta o texto aqui; nenhum componente tem frase do mascote embutida.
 *
 * Tom: primeira pessoa, amigável e profissional, frases curtas, pt-BR.
 * `target` liga o passo ao atributo `data-tour="..."` de um elemento real da tela (sem `target`
 * o balão fica centralizado). `desktopOnly`: passo que só faz sentido com a sidebar visível
 * (a partir de 1024px) — no celular o menu é uma gaveta, então esses passos são resumidos no
 * passo do botão de menu (`bodyMobile`).
 */

export type TourStepKind = "welcome" | "step" | "finish";

export type TourStepContent = {
  id: string;
  kind: TourStepKind;
  /** Valor de `data-tour` do elemento destacado. Ausente = balão centralizado. */
  target?: string;
  /** Alvo alternativo quando a tela é estreita (< 1024px). */
  targetMobile?: string;
  desktopOnly?: boolean;
  title: string;
  body: string;
  /** Texto alternativo para telas estreitas (mesmo passo, outra redação). */
  bodyMobile?: string;
};

export const MASCOT_NAME = "Inno";

export const TOUR_STEPS: TourStepContent[] = [
  {
    id: "welcome",
    kind: "welcome",
    title: "Oi! Eu sou o Inno 👋",
    body:
      "Vou te mostrar o painel em poucos passos, sem pressa. Depois é só seguir o checklist " +
      "de Primeiros passos, e o seu bot já sai agendando sozinho.",
  },
  {
    id: "menu",
    kind: "step",
    target: "sidebar",
    targetMobile: "menu-button",
    title: "Este é o seu menu",
    body:
      "Aqui ficam todas as áreas do painel, agrupadas por assunto. É por ele que você vai " +
      "para qualquer lugar.",
    bodyMobile:
      "No celular, o menu fica neste botão. Nele você encontra Início, Agenda, Agendamentos, " +
      "Clientes, Serviços, Profissionais, WhatsApp, Mensagens do bot, Configurações e Assinatura.",
  },
  {
    id: "inicio",
    kind: "step",
    target: "nav-inicio",
    desktopOnly: true,
    title: "Início",
    body: "Meu lugar favorito! Aqui você vê o resumo do dia, os próximos agendamentos e o checklist de Primeiros passos.",
  },
  {
    id: "agenda",
    kind: "step",
    target: "nav-agenda",
    desktopOnly: true,
    title: "Agenda",
    body: "A agenda por dia ou por semana. Você marca, remarca e bloqueia horários por aqui.",
  },
  {
    id: "agendamentos",
    kind: "step",
    target: "nav-agendamentos",
    desktopOnly: true,
    title: "Agendamentos",
    body: "A lista de todos os agendamentos, com filtros. Aqui você confirma, cancela e acompanha quem faltou.",
  },
  {
    id: "clientes",
    kind: "step",
    target: "nav-clientes",
    desktopOnly: true,
    title: "Clientes",
    body: "Quem já falou com o seu bot vira cliente aqui, com o histórico de cada um.",
  },
  {
    id: "catalogo",
    kind: "step",
    target: "nav-servicos",
    desktopOnly: true,
    title: "Catálogo",
    body:
      "Cadastre seus serviços, os profissionais que atendem e os horários de cada um. " +
      "É com isso que eu sei o que oferecer e quando.",
  },
  {
    id: "whatsapp",
    kind: "step",
    target: "nav-whatsapp",
    desktopOnly: true,
    title: "WhatsApp",
    body: "Conecte o número da empresa lendo um QR code. Sem isso eu não consigo conversar com os seus clientes.",
  },
  {
    id: "mensagens-bot",
    kind: "step",
    target: "nav-mensagens-bot",
    desktopOnly: true,
    title: "Mensagens do bot",
    body: "Aqui você ajusta o que eu digo: boas-vindas, confirmações e lembretes. Deixe com a cara da sua empresa.",
  },
  {
    id: "configuracoes",
    kind: "step",
    target: "nav-configuracoes",
    desktopOnly: true,
    title: "Configurações",
    body: "Aparência do painel, equipe, bloqueios e feriados. Dá para escolher o tema visual da sua empresa em Aparência.",
  },
  {
    id: "assinatura",
    kind: "step",
    target: "nav-assinatura",
    desktopOnly: true,
    title: "Assinatura",
    body: "Seu plano, suas faturas e o pagamento por Pix ficam aqui.",
  },
  {
    id: "status",
    kind: "step",
    target: "topbar-status",
    title: "Status do WhatsApp",
    body: "Este indicador mostra se o bot está ativo. Se o número cair, você vê aqui na hora.",
  },
  {
    id: "busca",
    kind: "step",
    target: "topbar-search",
    title: "Busca rápida",
    body: "Aperte Ctrl K (ou Cmd K) e digite para ir a qualquer tela ou criar algo sem tirar a mão do teclado.",
    bodyMobile: "Toque na lupa para ir a qualquer tela ou criar algo rapidinho.",
  },
  {
    id: "fim",
    kind: "finish",
    title: "Pronto! Agora é com a gente 🚀",
    body:
      "Vamos deixar tudo pronto para o seu bot agendar sozinho? Siga o checklist de Primeiros " +
      "passos no Início. Se quiser rever este tour, é só pedir no menu.",
  },
];

export const TOUR_UI = {
  dialogLabel: "Tour guiado com o Inno",
  next: "Próximo",
  back: "Voltar",
  skip: "Pular tour",
  start: "Vamos lá",
  finish: "Concluir",
  replay: "Rever tour",
  progress: (current: number, total: number) => `${current} de ${total}`,
} as const;

/** Passos do checklist — a ordem e o `key` seguem o contrato de `OnboardingState.steps`. */
export type ChecklistStepKey = "services" | "professionals" | "hours" | "whatsapp" | "botTest";

export const CHECKLIST_STEPS: {
  key: ChecklistStepKey;
  title: string;
  description: string;
  /** Caminho relativo ao tenant (`/{slug}/{path}`). */
  path: string;
  cta: string;
}[] = [
  {
    key: "services",
    title: "Cadastrar serviços",
    description: "O que você oferece, com duração e preço.",
    path: "servicos",
    cta: "Cadastrar",
  },
  {
    key: "professionals",
    title: "Cadastrar profissionais",
    description: "Quem atende os seus clientes.",
    path: "profissionais",
    cta: "Cadastrar",
  },
  {
    key: "hours",
    title: "Definir horários",
    description: "Os dias e horas em que cada profissional atende.",
    path: "profissionais",
    cta: "Definir",
  },
  {
    key: "whatsapp",
    title: "Conectar o WhatsApp",
    description: "Leia o QR code com o celular da empresa.",
    path: "whatsapp",
    cta: "Conectar",
  },
  {
    key: "botTest",
    title: "Testar o bot",
    description: 'Mande um "oi" de outro número para o WhatsApp da empresa e veja eu responder.',
    path: "whatsapp",
    cta: "Ver número",
  },
];

export const CHECKLIST_UI = {
  title: "Primeiros passos",
  intro: "Vamos deixar tudo pronto para o seu bot agendar sozinho.",
  progress: (done: number, total: number) => `${done} de ${total} passos`,
  done: "Feito",
  hide: "Esconder",
  hideLabel: "Esconder o checklist de Primeiros passos",
  doneTitle: "Parabéns, está tudo pronto! 🎉",
  doneBody: "O seu bot já pode agendar sozinho. Se precisar de mim, é só chamar pelo menu.",
  close: "Fechar",
  error: "Não consegui salvar agora. Tente de novo em instantes.",
} as const;
