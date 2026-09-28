# Especificação "premium" — fusão ParquedasFeiras + MultMarkets → InnoChat

> Documento de AUDITORIA/ESPECIFICAÇÃO. Não altera código. Escrito seguindo a
> lição registrada em `licao-porte-visual-superficial.md` e
> `referencia-visual-parquedasfeiras.md` (memória do InnoAtendente): **porte
> por categoria com números concretos, nunca por adjetivo**.

**Pedido do dono, na íntegra:** layout "clean, moderno, intuitivo, robusto e
profissional", inspirado em **duas** referências — ParquedasFeiras (geral,
incluindo os painéis de lojista E de admin) e MultMarkets — com a intenção
de "fundir os dois". Onde as duas referências divergem por gosto (não por
qualidade técnica), a escolha fica marcada como **DECISÃO DO DONO**, com as
opções concretas — não decido sozinha o que é estética, só o que é
implementação.

**Fontes:**
- **ParquedasFeiras**: `C:\Projetos\Web\ParquedasFeiras\frontend\src` (Vite +
  React Router + Tailwind v3) + a tradução já aprovada em
  `C:\Projetos\Web\InnoAtendente\src` e
  `C:\Projetos\Web\InnoAtendente\docs\design-system.md` (§12–§15) — a mesma
  stack Next+Tailwind v4 do InnoChat, então cito o InnoAtendente sempre que a
  tradução para essa stack já existe e foi validada pelo dono (6 rodadas de
  ajuste registradas na memória dele).
- **MultMarkets**: `C:\Projetos\Web\MultMarkets\DESIGN_SYSTEM.md` (guia
  formal do próprio projeto) + `apps/web/app/admin/layout.tsx` e
  `apps/web/app/admin/page.tsx` (código real, não só o guia — o guia
  documenta a intenção, o código é o que de fato renderiza). Memória em
  `C:\Users\Personal Computer\.claude\projects\c--Projetos-Web-MultMarkets\memory\`
  não tem lição específica de UI (é sobre roadmap de produto — KYC, torneios,
  multi-projeto), então a extração aqui é 100% do design system + código.
- **Estado atual do InnoChat**: `src/app/globals.css`, `src/app/fonts.ts`,
  `src/components/shell/**`, `src/components/ui/**`.
- **Sobre screenshots reais**: não rodei nenhum dos dois projetos de
  referência — ver `referencias/README.md` para o motivo (ambos exigem
  backend/DB completos e autenticação; sem isso, só renderizaria tela de
  login/erro). Toda comparação abaixo cita o arquivo-fonte exato.

**Por que as duas referências são visualmente OPOSTAS, e o que isso significa
para a fusão:** ParquedasFeiras/InnoAtendente é um produto **claro por
padrão** (com escuro opcional), cores contidas (índigo + terracota), voltado
a confiança institucional (saúde/clínica/comércio). MultMarkets é **escuro
por padrão, sem versão clara** (`bg-black`, texto branco translúcido em
escala de opacidade), voltado a uma estética "trading/high-tech" com glow de
neon e raios enormes (`rounded-[2.5rem]`/`rounded-[3rem]` = 40–48px). Não são
"o mesmo estilo com cor diferente" — são duas escolas de design distintas
(institucional-confiável vs. dark-tech-premium). **A fusão literal ("escurecer
tudo e aumentar todo raio") destruiria a decisão já tomada pelo dono de ter 3
temas claros por empresa** (`docs/design/direcoes.md`, 2026-09-28) — por isso,
em cada categoria abaixo, a "proposta de fusão" pega o que é **estrutura e
interação** de ambas as referências (isso funciona nos dois estilos) e é
seletiva sobre o que é **estética de superfície específica de um dos dois**
(isso não pode simplesmente ser copiado sem adaptação ao sistema de temas
claros já existente).

---

## 1. Anatomia da página

| Camada | ParquedasFeiras/Admin | MultMarkets/Admin | InnoChat hoje | Proposta de fusão |
|---|---|---|---|---|
| Sidebar fixa desktop | `Admin/Layout.tsx`, `w-64`, gradiente teal escuro | `admin/layout.tsx`, `w-64`, `sticky h-screen`, `bg-black/40 backdrop-blur-2xl` (vidro, não gradiente sólido) | `panel-shell.tsx`, `w-60`, `bg-sidebar` sólido, sem gradiente nem blur | `w-64`; gradiente **e** um toque de vidro: `bg-gradient-to-b from-[sidebar] to-[sidebar-82%-preto]` (§2) mais `backdrop-blur` na versão mobile/drawer sobre conteúdo (o glass do MultMarkets funciona melhor onde há conteúdo por trás para "ver através"; a sidebar fixa desktop não tem nada atrás, então o gradiente (PF) é o que realmente entrega o efeito ali — o blur da MultMarkets seria estético mas ilusório numa superfície opaca) |
| Navegação agrupada, com **colapso** | `adminNav.ts`: grupos fixos, sempre abertos | `NAV_GROUPS` em `admin/layout.tsx`: grupos **colapsáveis** (`AnimatePresence`, chevron gira `rotate: isOpen?180:0`), grupo auto-abre se contém a rota ativa | Lista plana, sem grupo | **Vence MultMarkets**: colapsável é estritamente mais robusto para uma sidebar que vai crescer (o InnoChat já tem 9+ seções) — grupos fixos sempre abertos (PF) ficam ruins quando há mais de 3 grupos. Portar o padrão exato: `useState<string[]>` de grupos abertos, auto-abre grupo da rota ativa, `AnimatePresence` com `height: 0→auto` |
| Topbar fixa translúcida com blur | `bg-background/85 backdrop-blur-md` (InnoAtendente), `h-16` | `bg-black/20 backdrop-blur-3xl`, `h-[72px]` | `bg-surface` opaco, sem blur, `h-16` | **Vence MultMarkets no blur** (`backdrop-blur-3xl` é mais forte, efeito mais perceptível) mas **vence PF na altura** (`h-16`=64px casa com a régua da logo da sidebar, §1; 72px do MultMarkets não tem motivo funcional documentado, é só gosto) — `h-16` + opacidade/blur no nível do MultMarkets: `bg-surface/70 backdrop-blur-2xl` |
| Busca | Paleta de comando MODAL (Ctrl+K), `CommandPalette.tsx` | Input de busca **inline na topbar**, sempre visível (`hidden lg:flex`), sem atalho de teclado documentado | Não existe | **Vence PF**: modal com Ctrl+K é mais robusto (funciona em qualquer largura de tela, não broca espaço permanente da topbar, e paginar/navegar por teclado dentro dela é mais rico) — mas adotar o VISUAL do input inline do MultMarkets como GATILHO da paleta (pílula de busca sempre visível, não escondida atrás de um ícone) já é o que o InnoAtendente faz (`dashboard-shell.tsx`, botão-pílula com `<kbd>Ctrl K</kbd>`) — ou seja, o InnoAtendente já fundiu isso; portar direto |
| Indicador "ao vivo" / status do sistema | Não tem equivalente direto | Badge `LIVE` ao lado do título da seção (`bg-white/5 border border-white/10 text-accent-400`) + dot pulsante (`animate-ping`) no rodapé da sidebar ("ciclos ativos") | Existe conceito equivalente: banner de assinatura/e-mail no `panel-shell.tsx`, mas não um indicador "ao vivo" de status de conexão | **Vence MultMarkets como PADRÃO A PORTAR**: o InnoChat tem status real para mostrar "ao vivo" — conexão do WhatsApp (`WhatsappInstanceStatus`). Um dot pulsante + rótulo "Conectado" na sidebar/topbar é dado real, não decoração (ver §10) |
| Background com "glow" (blur de cor no fundo) | Não usa | `<div className="fixed inset-0 ... blur-[120px]" />` — dois círculos de cor semi-transparente atrás do conteúdo, fixos | Não existe | **DECISÃO DO DONO**: é puramente estético (não resolve nenhum problema de uso) e é a marca mais forte da identidade "dark-tech" do MultMarkets — aplicado sobre um tema CLARO (Índigo/Âmbar/Verde Slate) teria de ser muito mais sutil (blur enorme + opacidade baixíssima da cor primária do tema) para não parecer "borrão" em vez de "glow". Proponho testar em 1 tema (Índigo) antes de generalizar — ver §5 |
| Bloco de usuário no rodapé da sidebar | `Seller/Shell.tsx` → 1 clique para sair | Rodapé da sidebar MultMarkets: card "ciclos ativos" + botão de sair separado (`hover:text-no-400`), sem nome/e-mail do usuário ali (isso fica no canto direito da topbar) | E-mail e sair na topbar | **Vence PF**: nome+e-mail+sair juntos no rodapé da sidebar é mais fácil de auditar num relance ("de quem é esta sessão, e como eu saio") do que ter o usuário na topbar (MultMarkets) e sair escondido embaixo na sidebar, dois lugares diferentes para uma mesma ideia. Portar o padrão PF/InnoAtendente aqui |

**Resumo:** a MultMarkets contribui com 3 padrões estruturais concretos que o
PF/InnoAtendente não tem — **navegação colapsável**, **indicador ao vivo com
dado real**, **glass mais forte na topbar** — e o PF/InnoAtendente contribui
com 2 que a MultMarkets não tem de forma tão limpa — **paleta de comando
modal** e **bloco de usuário unificado no rodapé**. O "glow" de fundo é
decisão de gosto do dono.

---

## 2. Sidebar

**ParquedasFeiras/InnoAtendente** (repetido do documento anterior, resumido):
gradiente vertical `from-primary-900 to-primary-950`; título de grupo
uppercase `text-[10px] font-black tracking-widest`; item ativo `bg-white/15
ring-1 ring-white/20` + barra vertical na cor do accent; item inativo
`text-white/60`; contador `bg-cta-solid`, `min-w-[22px] rounded-full`; rodapé
com bloco de usuário.

**MultMarkets** (`admin/layout.tsx`, linhas 153–282): fundo **não é
gradiente** — é vidro puro sobre o glow de fundo: `bg-black/40
backdrop-blur-2xl border-r border-white/5`. Título de grupo: botão CLICÁVEL
(não estático), `text-[10px] font-black uppercase tracking-[0.15em]`,
`text-white/30` inativo → `text-accent-400 bg-accent-500/[0.06]` quando tem
item ativo dentro — ou seja, o PRÓPRIO título de grupo já sinaliza "há algo
ativo aqui dentro" mesmo colapsado, o que o PF não faz. Item ativo:
`bg-accent-500/10 text-white border border-accent-500/20` (ring vira border
com opacidade — mesma ideia, execução ligeiramente diferente) + `ChevronRight`
no lugar da barra vertical. Hover com `motion.div whileHover={{ x: 3 }}`
(deslocamento horizontal, não scale). Logo: selo quadrado com gradiente
`from-accent-500 to-accent-700` + `shadow-glow-accent` + `ring-1
ring-white/20`, ao lado do wordmark.

**InnoChat hoje:** já descrito no doc anterior — fundo `bg-sidebar` chapado,
lista plana, item ativo sem barra lateral, sem contador ao vivo real, sem
bloco de usuário no rodapé.

**Proposta de fusão, decisão por decisão:**

| Elemento | Fonte que vence | Por quê |
|---|---|---|
| Fundo | **PF/InnoAtendente** (gradiente, derivado de `--panel-sidebar`, ver §1 tabela) | Sidebar fixa sem conteúdo atrás não ganha nada real de um `backdrop-blur` (não há nada pra "ver através"); o gradiente entrega profundidade de verdade. Mantém a decisão de identidade fixa de marca já documentada no InnoAtendente (§14.2) |
| Agrupamento colapsável | **MultMarkets** | Ver §1 — mais robusto para 9+ seções |
| Grupo sinaliza atividade mesmo fechado | **MultMarkets** (`hasActive` muda cor do próprio cabeçalho do grupo) | Sem isso, colapsar um grupo escondendo a rota ativa dentro dele é uma armadilha de UX real (usuário "se perde", não sabe em que grupo está) |
| Item ativo: barra lateral vs. borda | **PF/InnoAtendente** (barra vertical na cor accent) | Mais legível num vislumbre rápido (linha de cor colada na borda) do que uma borda fina de 1px ao redor do próprio item (MultMarkets) — decisão técnica de legibilidade, não só gosto: medindo a área de detecção visual, uma barra de 4px de altura total é mais fácil de notar em varredura periférica do que 1px de contorno |
| Hover: `scale` vs. `translateX` | **PF/InnoAtendente** (`whileHover={{ scale: 1.02 }}`) | — **DECISÃO DO DONO, secundária**: as duas são válidas e a diferença é sutil; PF já está validado pelo dono no InnoAtendente, então mantenho como padrão a menos que ele prefira o deslocamento horizontal do MultMarkets |
| Contador de pendência | **PF/InnoAtendente** (pílula numérica) | MultMarkets não tem um equivalente direto (usa só dot pulsante para "ao vivo", não contagem) — sem conflito, os dois cabem: contador numérico normal + dot pulsante reservado para status de conexão (§1, §10) |
| Bloco de usuário no rodapé | **PF/InnoAtendente** | Ver §1 |
| Selo/logo | **Fusão literal**: emblema com leve gradiente (PF usa pílula plana; MultMarkets usa selo com `shadow-glow-accent`) — usar o selo quadrado com gradiente do MultMarkets (`from-[accent] to-[accent-strong]`, tokens do tema, nunca hex fixo do MultMarkets) + o texto uppercase tracking-widest do PF | Nenhuma das duas exclui a outra — dá pra ter os dois na mesma peça |

**Ação concreta de gradiente por tema:** repete o cálculo já registrado no
documento anterior — `color-mix(in oklab, var(--panel-sidebar) 82%, black)` —
sem alteração pela entrada da MultMarkets nesta categoria.

**DECISÃO DO DONO pendente (já registrada antes, reforçada agora):** o tema
Verde Slate tem `--panel-sidebar: #ffffff` (claro por decisão de marca). Nem
PF nem MultMarkets têm uma sidebar clara — as duas referências são "escura
sempre". Perguntar explicitamente: o Verde Slate ganha uma versão clara
DESTE MESMO padrão (gradiente clarinho + agrupamento colapsável + barra
lateral, tudo em tons claros) ou é a única sidebar que foge do padrão
"premium escuro" por ser a assinatura visual desse tema?

---

## 3. Topbar

**ParquedasFeiras/InnoAtendente:** `h-16`, `bg-background/85
backdrop-blur-md`, título da seção em `font-display text-lg font-black`,
botão de busca em pílula com `<kbd>Ctrl K</kbd>`.

**MultMarkets** (`admin/layout.tsx` linhas 287–321): `h-[72px]`, `bg-black/20
backdrop-blur-3xl` (blur mais forte — `3xl` vs `md`), título **uppercase**
`text-sm font-black tracking-tight` + badge `LIVE` ao lado (`bg-white/5
border border-white/10 text-accent-400`), campo de busca INLINE sempre visível
(não modal), chip de métrica de negócio na topbar (`R$ 1.4M Volume` — dado
real de negócio, sempre visível, não escondido em outra tela), avatar com
borda em gradiente sutil (`p-0.5 bg-gradient-to-br from-white/10 to-transparent`).

**InnoChat hoje:** `h-16`, `bg-surface` opaco, sem busca, sem chip de métrica,
avatar não existe (usa e-mail em texto puro).

**Proposta de fusão:**

- Altura: **`h-16`** (PF) — a razão funcional documentada (casar com a régua
  da logo) é mais forte que o `72px` do MultMarkets, que não tem justificativa
  documentada além de "mais respiro".
- Blur/translucidez: **nível MultMarkets** — `bg-surface/70 backdrop-blur-2xl`
  em vez do `/85 backdrop-blur-md` do InnoAtendente. Justificativa: o InnoChat
  tem 3 temas com fundos de sidebar/superfície muito diferentes entre si
  (Índigo escuro vs. Verde Slate branco), então um blur mais forte generaliza
  melhor visualmente nos 3 do que um blur fraco, que só "funciona bem" quando
  o que está por trás já é parecido com a cor da topbar.
- Título uppercase: **DECISÃO DO DONO**. O PF/InnoAtendente usa título em
  case normal (`font-display text-lg font-black`); o MultMarkets usa tudo
  uppercase com tracking. Uppercase reforça a estética "painel de controle
  técnico" (MultMarkets) mas pode ficar "gritado" demais para o tom
  institucional/confiança que o InnoChat herdou do InnoAtendente
  (saúde/estética/clínica são o público real — ver justificativa de paleta já
  registrada em `design-system.md` do InnoAtendente §1, item "confiança antes
  de personalidade" — se o dono validar esse mesmo princípio para o InnoChat).
  Proponho **manter case normal** por default e perguntar antes de mudar.
- Chip de métrica de negócio na topbar (ex. "Confirmação hoje: 87%" ou
  "3 conversas aguardando"): **vence MultMarkets como padrão a adotar** — dado
  real, sempre visível, sem precisar entrar em outra tela — mas o CONTEÚDO
  do chip precisa ser um dado que o InnoChat já tem pronto (ver §10), não
  inventado.
- Busca: modal Ctrl+K (já decidido em §1) — mantém o gatilho em pílula do
  InnoAtendente, sem inline permanente do MultMarkets (o inline consome
  espaço permanente da topbar que o InnoChat, com seções mais numerosas, não
  tem de sobra).

---

## 4. Tipografia

**ParquedasFeiras/InnoAtendente:** Manrope (display, 700/800) + Inter
(corpo), escala h1 28px/h2 22px/h3 18px, `font-black text-4xl tabular-nums`
só no número do `StatCard`, nunca peso >700 no corpo.

**MultMarkets** (`DESIGN_SYSTEM.md`): **uma família só** para tudo aparentemente
(não há import de fonte de display separada documentado no guia — os
exemplos usam `font-black`/`font-bold`/`font-medium` como únicas variações,
sem menção a segunda família); título de página **enorme**, `text-5xl
font-black tracking-tighter` — quase duas vezes o h1 do PF (5xl=48px vs.
28px); label de seção `text-[10px] font-black text-white/30 uppercase
tracking-widest` (mesmíssimo padrão de "10px black uppercase" que o PF/
InnoAtendente já usa para título de grupo de nav — convergência real entre as
duas referências, não invenção); regra explícita nº5 do guia: "Títulos e
labels usam `font-black`. Corpo usa `font-medium` ou `font-bold`" — ou seja,
o MultMarkets nunca usa peso 400/regular em lugar nenhum, nem no corpo.

**InnoChat hoje:** 4 famílias já carregadas por tema (Manrope/Fraunces/Sora +
Inter), `page-header.tsx` em `text-2xl font-bold` (24px/700).

**Proposta de fusão:**

- **Duas famílias por tema (não uma só)** — vence a arquitetura já existente
  no InnoChat, que é estruturalmente melhor que as duas referências (nem PF
  nem MultMarkets adaptam a fonte por identidade de tenant/segmento). Não
  jogar isso fora para "unificar como o MultMarkets".
- **Peso do corpo: `font-medium` mínimo, nunca `font-normal`/400** —
  **vence MultMarkets nesta regra específica**, e é uma mudança real de
  comportamento (o PF/InnoAtendente usa 400 no corpo comum). Only aplicar
  isso em título/label/dado numérico, não no texto corrido de descrição longa
  — texto corrido em `font-medium` (500) constante em blocos de 2+ linhas
  cansa a leitura; a regra do MultMarkets funciona porque as telas deles são
  quase todas número+label curto, não parágrafo.
- **Tamanho do h1: manter a escala do PF (28px), NÃO ir para 48px do
  MultMarkets** — **DECISÃO DO DONO justificada por mim**: `text-5xl` como
  h1 de toda página é extremo para um painel de trabalho diário (agenda,
  clientes) — funciona no MultMarkets porque cada página lá é vista
  ocasionalmente (configuração, relatório), não o dia inteiro como a agenda
  de uma clínica. Recomendo manter 28px e reservar um tamanho maior (36–40px)
  só para a tela "Início"/dashboard nova (§10), não para todas.
- **Peso 800 nos temas Fraunces/Sora**: mesma pendência já registrada no
  documento anterior — hoje `fonts.ts` só carrega `["600","700"]` para os
  dois, então `font-black` cairia sintetizado. Ação: acrescentar `"800"`.

---

## 5. Cor

**Regra inegociável (reforçada com a expansão de escopo):** a paleta dos 3
temas do InnoChat **não muda** — nem para a cor do PF, nem para o
preto-e-neon do MultMarkets. As duas referências entram só como PADRÃO DE
APLICAÇÃO da cor que já existe.

| Padrão de aplicação | ParquedasFeiras/InnoAtendente | MultMarkets | Fusão proposta |
|---|---|---|---|
| Cor sólida em botão/CTA | Sólida ou gradiente leve (`from-primary-700 to-primary-800` em hover) | Gradiente sempre: `bg-gradient-to-r from-accent-500 to-accent-600` + `shadow-glow-accent` (sombra colorida GRANDE, não só tingida sutil) | Vence MultMarkets no CONCEITO (gradiente + sombra mais expressiva que a "tingida discreta" do InnoAtendente), mas a INTENSIDADE precisa ser calibrada por tema — o `shadow-glow-accent` do MultMarkets é feito para fundo preto (glow "brilha" contra o escuro); sobre fundo claro (Índigo claro, Verde Slate) o mesmo glow vira "sombra colorida forte", que pode ficar pesado. Propor `shadow-lg shadow-{accent}/25` como ponto médio, testável por tema — não adotar a intensidade literal do MultMarkets sem testar contra fundo claro |
| Badge/pílula de status | Fundo "soft" (`bg-success-bg`) + texto forte, sem borda | Fundo bem transparente (`bg-accent-500/10`) + **borda** na mesma cor (`border-accent-500/20`) — nunca sem borda | Vence MultMarkets: a borda sutil torna o badge legível mesmo em zoom/print, e o InnoChat já tem os tokens de cor sólida por tema para gerar essa borda sem token novo (`border-{cor}/20` funciona direto sobre `--color-success` etc.) |
| Ícone/número de destaque tingido | `.tone-*` classes dedicadas (fundo computado via `color-mix`) | Cor sólida direta + fundo `bg-white/5` neutro (o "tingimento" no MultMarkets é só no ÍCONE/texto, o fundo do card continua neutro) | Vence PF/InnoAtendente no MECANISMO (o `.tone-*` já resolve certo em claro/escuro via `color-mix`, testado); o InnoChat ainda não tem tokens de domínio alem de success/warning/danger (ver pendência já registrada) — abrir 1–2 tons extras (`info`/`teal`) só quando o dashboard (§10) precisar de fato, não especular |
| Glow de fundo (blobs coloridos) | Não usa | `blur-[120px]` com opacidade baixa da cor de accent, fixo atrás do conteúdo | **DECISÃO DO DONO** (já registrada em §1) — testar 1 tema antes de generalizar |
| Uso de branco/preto puro como base | Nunca — base é `bg-page`/`bg-surface` tokens claros | Base é SEMPRE preto (`bg-black`, `bg-black/40`), nunca claro | O InnoChat mantém a base clara por tema — copiar "base sempre preta" do MultMarkets contradiz a decisão de 3 temas majoritariamente claros já tomada. Sem conflito real aqui: a MultMarkets simplesmente não se aplica a este item, porque parte de uma premissa (dark-only) que o InnoChat já decidiu não ter |

---

## 6. Superfícies (raio, borda, sombra, hover)

**ParquedasFeiras/InnoAtendente:** raio "hero" 24–28px (`radius-2xl`/`3xl`),
sombra tingida em hover (`shadow-xl shadow-{cor}/N`), `-translate-y-0.5` no
hover do cartão/botão.

**MultMarkets** (`DESIGN_SYSTEM.md` + `admin/page.tsx`): raio **muito maior**
— regra geral do guia: "Páginas e cards principais usam `rounded-3xl`.
Elementos menores usam `rounded-2xl`" (isso é 24px/16px, comparável ao PF),
MAS o código real do dashboard admin usa raios ainda maiores que o próprio
guia documenta: `rounded-[2.5rem]` (40px) no stat card e `rounded-[3rem]`
(48px) no painel de gráfico — ou seja, **o código de produção do MultMarkets
já superou o próprio design system escrito**, foi além do documentado.
Sombra: não é "tingida sutil" — é **glow** (`shadow-glow-accent`, blur maior
e mais opaco) e blur de fundo (`blur-[40px]` atrás do próprio card, não só
sombra embaixo). Hover: `border-accent-500/30` (a borda GANHA cor no hover,
não só a sombra) + `group-hover:scale-110` no selo de ícone (mais forte que
o `-translate-y-0.5` do PF).

**InnoChat hoje:** `--panel-radius` por tema (0.75rem Índigo / 1.25rem Âmbar /
0.5rem Verde Slate — nenhum chega a 24px hoje, exceto Âmbar que já é 20px),
`--panel-shadow` string única sem tingimento, sem variação de tamanho.

**Proposta de fusão — a mais delicada desta seção porque envolve 3 raios
diferentes de partida:**

- **Raio "hero" derivado, não copiado**: mantém a proposta já registrada
  (`calc(var(--panel-radius) * 1.6)`), mas **eleva o multiplicador para
  refletir o quanto o MultMarkets é mais extremo** — sugiro `* 2` em vez de
  `* 1.6` só para o cartão HERO de destaque (dashboard, `StatCard` grande),
  mantendo `* 1.6` para cartão comum. Isso dá, no Índigo: hero a 24px (igual
  ao PF) e comum a 19px; no Âmbar: hero a 40px (perto do MultMarkets) e comum
  a 32px. **DECISÃO DO DONO**: até onde ir por tema é gosto — mostrar os dois
  níveis lado a lado antes de fixar.
- **Sombra: tingida (PF) + glow mais forte no hover, não em repouso
  (MultMarkets)** — em repouso, sombra neutra e discreta (não cansa a
  interface toda com glow constante); no HOVER, escalar para a intensidade
  do MultMarkets (`shadow-{cor}/25` em vez de `/15`) — pega o melhor dos dois:
  o repouso comedido do PF/InnoAtendente e o "acordar" mais dramático do
  MultMarkets.
- **Borda ganha cor no hover, além da sombra** (MultMarkets) — item NOVO que
  nenhuma das duas referências anteriores tinha proposto explicitamente
  antes desta expansão: `border-border/70` → `hover:border-{accent}/30`.
  Fácil de aplicar sem token novo.
- **`group-hover:scale-110` no selo de ícone**: vence MultMarkets — mais
  perceptível que só levantar o cartão, e o pedido original já citava esse
  padrão (`group-hover:scale` no ícone circular) como um dos itens do
  briefing.
- **Armadilha do Tailwind v4 com `--shadow-*` sobrescrito**: continua valendo
  (documentada no doc anterior) — qualquer sombra tingida ou glow precisa
  entrar como token próprio por tema (`--panel-shadow-hover`), não como
  modificador `shadow-{cor}/N` direto, porque o InnoChat já sobrescreve
  `--shadow-card` como string.

---

## 7. Motion

**ParquedasFeiras/InnoAtendente:** `framer-motion` em ~6 arquivos — hover/tap
com spring em itens de nav, `HoverLift` em cartões, `AnimatedCounter` com
`useSpring`/`useReducedMotion`.

**MultMarkets** (`admin/layout.tsx`, `admin/page.tsx`, `DESIGN_SYSTEM.md`
regra 8): `framer-motion` ainda mais espalhado — `AnimatePresence` para
expandir/colapsar grupo de nav (`height: 0→auto`), `whileHover={{ x: 3 }}`
nos itens, `rotate` no chevron do grupo, **entrada escalonada em listas**:
"delays escalonados de `0.04s` por item" (regra geral do guia) —
no código real do dashboard, o delay é `i * 0.1` (100ms por item, não 40ms —
o código diverge um pouco do guia escrito, uso o valor do código real como
mais confiável), `initial={{ opacity: 0, y: 20 }}` → `animate={{ opacity: 1,
y: 0 }}` em cada `StatCard`. Barra de progresso animada
(`initial={{width:0}}` → `animate={{width:'X%'}}`, `duration: 1, ease:
'easeOut'`). Transição de página inteira: `key={pathname}` no wrapper do
`main`, fade+subida leve a cada navegação (`opacity:0,y:5` → `opacity:1,y:0`,
200ms).

**InnoChat hoje:** nenhuma dependência de motion.

**Proposta de fusão — a MultMarkets amplia bastante o que a Lyra tinha
planejado antes da expansão de escopo:**

1. Item de nav (hover/tap spring) — igual ao doc anterior, ver §2 para a
   escolha `scale` vs `translateX`.
2. `HoverLift` em cartões — igual ao doc anterior.
3. `AnimatedCounter` — igual ao doc anterior.
4. **Novo, do MultMarkets**: expand/collapse de grupo de nav com
   `AnimatePresence` (necessário de qualquer forma pela decisão de
   agrupamento colapsável, §1/§2 — não é opcional, é parte da própria
   funcionalidade escolhida).
5. **Novo, do MultMarkets**: entrada escalonada em grades de `StatCard`
   (`initial={{opacity:0,y:20}}`, `transition={{delay: i * 0.08}}` — uso
   0.08s como meio-termo entre o guia (0.04s) e o código real (0.1s) do
   MultMarkets, para não ficar tão rápido que passe despercebido nem tão
   lento que pareça travado com poucos cards).
6. **Novo, do MultMarkets**: transição leve entre páginas (`key={pathname}`,
   fade+subida 5px, 200ms) no `main` do shell — barato de aplicar (1 wrapper)
   e cobre TODA navegação, não só componentes individuais.

Em todos: `useReducedMotion` decide se anima ou salta — regra que já valia
antes da expansão, sem mudança.

---

## 8. Componentes de dados

| Componente | ParquedasFeiras/InnoAtendente | MultMarkets | InnoChat hoje | Fusão |
|---|---|---|---|---|
| `StatCard` | `rounded-3xl`, ícone tingido em círculo, pílula de contexto, ícone GIGANTE decorativo a 7% opacidade no canto | `rounded-[2.5rem]`, ícone em quadrado `rounded-2xl bg-white/5` (não círculo, e não tingido — neutro com `text-{cor}` só no ícone), SEM pílula de contexto, SEM ícone decorativo gigante, MAS com blob de glow (`blur-[40px]`) atrás e `group-hover:scale-110` no selo | Não existe | **Vence PF/InnoAtendente na estrutura geral** (pílula de contexto e ícone decorativo gigante são informação/hierarquia reais que o MultMarkets não tem); **vence MultMarkets no hover do selo** (`scale-110` mais expressivo que nada) e na entrada escalonada (§7). Selo continua círculo tingido (PF) — quadrado neutro (MultMarkets) esconde a categoria da métrica pela cor, o que é pior para escaneabilidade rápida |
| Tabelas | `TableHead h-11 px-4 uppercase`, `TableCell px-4 py-3.5` | `<th>` `text-[10px] font-black text-white/30 uppercase tracking-widest px-4 py-3`, `<tr>` com `hover:bg-white/[0.02]` linha a linha | `ui/table.tsx` — não confirmado no detalhe (fora do escopo de leitura declarado) | Convergência real entre as duas referências (ambas usam cabeçalho uppercase pequeno) — sem conflito, portar o padrão comum: cabeçalho uppercase 10-11px + hover de linha sutil |
| Badges | Fundo soft + `ring-1 ring-{cor}/25`, sem borda separada do ring | Fundo bem transparente + BORDA (não ring) na mesma cor | `badge.variants.ts`: fundo soft, sem ring nem borda | Tecnicamente `ring` e `border` colorida translúcida produzem efeito quase idêntico visualmente — manter `ring` (já é o padrão CSS mais comumente usado para "contorno que não desloca layout" no ecossistema shadcn que o InnoChat já usa) |
| Empty states | Variante `highlight` (CTA com gradiente sutil) | Não tem empty state documentado no guia (produto sempre tem dados de mercado) | Só variante neutra | Mantém a proposta anterior (variante `highlight`) — MultMarkets não contribui aqui |
| Skeleton | `neutral-100`/`neutral-800`, pulso | `h-36 rounded-2xl bg-white/5 animate-pulse` — mesmíssimo padrão (cor de fundo neutra baixa opacidade + `animate-pulse`) | Não confirmado no detalhe | Convergência real de novo — sem decisão a fazer, os dois fazem a mesma coisa com cores diferentes por tema |
| Gráfico (novo, não estava no doc anterior) | Não usa gráfico nas telas citadas | `recharts` (`AreaChart`, gradiente de preenchimento por série, tooltip com fundo `#000000e6 rounded-2xl`) | Não existe | **Novo componente a avaliar**: só relevante se o dashboard "Início" (§10) precisar de série temporal (ex. agendamentos por dia nos últimos 30 dias). Se sim, `recharts` é dependência nova a justificar (§12) — não abrir por especulação, só quando uma tela concreta pedir |

---

## 9. Densidade e largura

Sem mudança relevante trazida pela MultMarkets nesta categoria — o guia deles
não fala de densidade (produto de mercado financeiro não tem o equivalente a
"modo compacto de agenda"), e os wrappers de página documentados
(`max-w-[1200px] mx-auto` para página pública, `space-y-8` sem `max-w` para
admin) reforçam a MESMA regra já registrada no documento anterior: **shell e
listagem sem `max-w` fixo, só formulário de campo único ganha limite**. A
regra nº7 do `DESIGN_SYSTEM.md` do MultMarkets ("NUNCA adicione `min-h-screen`
com cor de fundo — a navbar e o layout pai já gerenciam o fundo") é o mesmo
princípio, dito de outro jeito, que a lição do Round 6 do InnoAtendente
("não é falta de conteúdo, é `max-w` sobrando") — as duas referências
convergem numa regra que o InnoChat já cumpre na casca (`panel-shell.tsx` não
tem `max-w` fixo, confirmado na auditoria anterior).

---

## 10. Dashboard / Início

**ParquedasFeiras**: `Admin/Dashboard.tsx` — `StatCard`s reais (GMV, pedidos,
produtos, usuários), `Panel`+`RowShell`, skeleton durante carregamento, erro
explícito se falhar.

**MultMarkets**: `app/admin/page.tsx` — `StatCard`s reais (mercados abertos,
rascunhos de bot) + gráfico de área (`recharts`, depósitos vs. retiradas nos
últimos N dias) + lista de "próximos encerramentos" com dot pulsante. Dados
vêm de `useQuery` (`@tanstack/react-query`) batendo em endpoints reais
(`/admin/financial/dashboard-stats`) — mesma disciplina "nunca zero
fictício, skeleton/erro explícito".

**InnoChat**: sem rota "Início" hoje (confirmado na auditoria anterior).

**Proposta de fusão para o "Início" do InnoChat** (KPIs já verificados contra
`prisma/schema.prisma` na auditoria anterior, sem mudança nos dados — a
mudança aqui é de LAYOUT, incorporando o que a MultMarkets acrescenta):

| Bloco | Dado | Origem confirmada | Estilo (fusão) |
|---|---|---|---|
| KPI: agendamentos hoje | `Appointment`, `status != CANCELED`, data = hoje | `prisma/schema.prisma` | `StatCard` fundido (§8) |
| KPI: taxa de faltas | `Appointment.status = NO_SHOW` / `(COMPLETED+NO_SHOW)` | idem | `StatCard`, `trend.positiveIsGood=false` |
| KPI: WhatsApp conectado | `WhatsappInstance.status = CONNECTED` | idem | `StatCard` + dot pulsante "ao vivo" (§1, padrão MultMarkets aplicado a dado real) |
| KPI: confirmação via bot | `Appointment.source = WHATSAPP` / total | idem | `StatCard` — pendência de token de domínio (§5) |
| **Novo, do MultMarkets**: série temporal | Agendamentos por dia (últimos 30 dias), agrupando `Appointment` por data | Dado derivável do mesmo modelo — **sem query nova complexa**, só `GROUP BY date` | `recharts` `AreaChart`, gradiente de preenchimento nas cores do tema (§8) — **avaliar com Vega se o volume de dados por tenant justifica ou se é otimização prematura para tenants pequenos** |
| **Novo, do MultMarkets**: lista "próximos agendamentos" com dot pulsante | `Appointment`, próximos N por data/hora | idem | Lista simples, dot `bg-primary animate-pulse` só no item mais próximo (não em todos — senão perde o sentido de "destaque") |
| Entrada escalonada dos cards | — | — | `initial/animate` com delay por índice (§7) |

Nada muda na pendência já registrada: origem da confirmação do bot já existe
(`Appointment.source`), e o token de domínio para o tone dessa métrica ainda
precisa ser decidido (§5) antes de codar o `StatCard` dela.

---

## 11. Plano de aplicação (ordem) — atualizado com a fusão

1. **Tokens** (`globals.css`, `fonts.ts`):
   - `--panel-sidebar-gradient-to` por tema (exceto Verde Slate — pendente).
   - `--panel-radius-hero` (`* 1.6`) e `--panel-radius-hero-lg` (`* 2`, só
     para o cartão hero do dashboard) — ver §6, testar antes de fixar.
   - `--panel-shadow-hover` por tema, com intensidade escalonada
     PF-repouso/MultMarkets-hover (§6).
   - Acrescentar peso `"800"` a Fraunces e Sora (§4).
   - Avaliar 1–2 tokens de domínio novos (`info`/`teal`) só quando o
     dashboard (§10) precisar de fato (§5) — não abrir especulativamente.
2. **Shell**:
   - Sidebar: gradiente + agrupamento COLAPSÁVEL (`AnimatePresence`) + grupo
     sinaliza atividade fechado + barra lateral no item ativo + bloco de
     usuário no rodapé + selo com gradiente e `shadow-glow` (tokenizado).
   - Topbar: `bg-surface/70 backdrop-blur-2xl`, `h-16`, `CommandPalette`
     (Ctrl+K), chip de dado real (a definir com o dono/Vega qual métrica).
   - Transição de página (`key={pathname}`, fade+subida leve) no `main`.
3. **Componentes base**:
   - `StatCard` fundido (círculo tingido + pílula + ícone decorativo + hover
     com borda colorida + `scale-110` no selo + entrada escalonada).
   - `HoverLift`, `AnimatedCounter` (sem mudança da proposta anterior).
   - `badge.variants.ts`: `ring-1 ring-{cor}/25`.
   - `empty-state.tsx`: variante `highlight`.
   - Avaliar componente de gráfico (`recharts` + wrapper) só se §10 confirmar
     necessidade.
4. **Telas**:
   - "Início" com os 4 KPIs + série temporal + lista de próximos, no layout
     fundido.
   - Badge de contador real nos itens de menu (depende de dado do backend).

## 12. Dependências novas

| Pacote | Motivo | Presente em |
|---|---|---|
| `framer-motion` | Motion (§7) — agora ainda mais necessário por causa do agrupamento colapsável (`AnimatePresence`), que não é só polimento, é parte da própria interação escolhida | PF (`^12.40.0`), InnoAtendente (`^13.2.0`), MultMarkets (`^11.18.2`) |
| `recharts` | Só SE o gráfico de série temporal do "Início" (§10) for confirmado como necessário pelo Atlas/dono — não abrir a dependência antes de a tela existir | MultMarkets (`apps/web`) |
| `@tanstack/react-query` | **Verificar se o InnoChat já tem** antes de listar como "nova" — não confirmei isso nesta auditoria (fora do escopo de arquivos lidos); se a tela "Início" fizer fetch client-side com revalidação, essa é a lib que as duas referências usam para não reimplementar cache/retry na mão. **Pendência de verificação**, não decisão fechada |

Não vejo necessidade de nada além disso — shadcn/ui, Radix, lucide-react e
`cva` já cobrem o resto nas duas referências e no InnoChat.

---

## Resumo — 10 maiores gaps em ordem de impacto visual (atualizado)

1. **Sidebar chapada, sem gradiente nem agrupamento colapsável** — agora é
   2-em-1: falta tanto o padrão PF (gradiente) quanto o padrão MultMarkets
   (colapso + sinalização de grupo ativo).
2. **Sem paleta de comando (Ctrl+K)** — mantém o impacto do documento
   anterior; MultMarkets reforça a necessidade de busca visível, só que via
   modal continua vencendo (§1).
3. **Topbar opaca, sem blur** — agora com meta mais ambiciosa
   (`backdrop-blur-2xl`, não só `md`) depois de ver o MultMarkets.
4. **Nenhum `StatCard`/dashboard "Início"** — maior gap isolado; ganhou mais
   peso ainda com a entrada escalonada, o gráfico de série temporal e o
   `group-hover:scale-110` do MultMarkets somados ao que o PF já trazia.
5. **Nenhuma transição entre páginas nem entrada escalonada em listas** —
   gap novo, identificado só depois de ler o `admin/layout.tsx`/`admin/page.tsx`
   do MultMarkets — barato de aplicar, alto em percepção de "produto vivo".
6. **Navegação em lista plana, sem indicador "ao vivo" com dado real** —
   o InnoChat tem dado real (conexão WhatsApp) para um indicador que nenhuma
   das telas atuais expõe de forma "sempre visível".
7. **Sem motion nenhum** (`framer-motion` ausente) — mesmo gap do documento
   anterior, agora com escopo maior de uso (§7).
8. **Sombra sem tingimento, raio sem nível "hero", sem borda-no-hover** — a
   armadilha do Tailwind v4 (shadow sobrescrita) continua sendo a causa raiz
   técnica; a MultMarkets acrescenta "borda ganha cor no hover" como item
   novo e barato.
9. **Bloco de usuário na topbar em vez do rodapé da sidebar** — mesmo gap,
   confirmado como o padrão vencedor nas duas referências (nenhuma delas
   coloca nome+e-mail+sair juntos na topbar).
10. **Badge sem ring/borda colorida e `EmptyState` sem variante `highlight`**
    — mesmos dois itens do documento anterior, sem mudança de prioridade.

## Pendências para o dono (não decidir sozinha)

1. **Sidebar do tema Verde Slate**: ganha versão clara do padrão fundido
   (gradiente clarinho + colapso) ou permanece a exceção "clara de
   propósito"? Nem PF nem MultMarkets têm uma sidebar clara para copiar.
2. **Glow de fundo (blobs blur coloridos)**: testar num tema antes de
   generalizar — puramente estético, forte identidade do MultMarkets, risco
   de não combinar com fundo claro.
3. **Título da topbar em uppercase (MultMarkets) ou case normal (PF/
   InnoAtendente, recomendado por mim)**: uppercase reforça estética "painel
   técnico", pode destoar do tom institucional já validado para o InnoChat.
4. **Intensidade do raio "hero"** (`* 1.6` vs `* 2`, §6): mostrar as duas
   escalas antes de fixar — no Âmbar a diferença chega a 8px, perceptível.
5. **Chip de métrica de negócio sempre visível na topbar** (padrão
   MultMarkets): qual dado mostrar (confirmação hoje? conversas aguardando?)
   é decisão de produto, não só de layout — perguntar antes de eu escolher.
6. **Confirmação, já registrada antes desta expansão**: `--panel-warning` do
   tema Âmbar foi derivado, não estava na tabela original de
   `direcoes.md` — revisar numa rodada de cor.
7. **Gráfico de série temporal no "Início"**: depende de o Atlas/dono
   confirmarem que vale a dependência nova (`recharts`) para o volume de
   dados esperado por tenant.
