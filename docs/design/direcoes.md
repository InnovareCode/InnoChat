# InnoChat — Direções visuais (proposta)

Três direções para calibrar o gosto do dono antes de construir telas reais.
Veja renderizadas em `docs/design/direcoes.html` (abrir no navegador; seletor
no topo alterna entre elas, funciona em desktop e celular).

Todas passam AA (≥ 4.5:1 texto normal, ≥ 3:1 texto grande/UI) — conferido com
cálculo de contraste real (WCAG relative luminance), não estimado.

## 1 · Índigo Clínico

Institucional e confiável, sem parecer frio. Indicado se o dono quer o painel
lendo como "sistema de gestão sério" desde o primeiro cadastro público.

| Token | Valor |
|---|---|
| Primária | `#2563EB` |
| Primária 700 (hover/texto sobre tinta) | `#1D4ED8` |
| Acento | `#0EA5E9` |
| Texto | `#0F172A` |
| Texto secundário | `#475569` |
| Fundo | `#F8FAFC` |
| Borda | `#E2E8F0` |
| Sucesso (texto sobre tinta `#DCFCE7`) | `#15803D` |
| Alerta (texto sobre tinta `#FEF3C7`) | `#B45309` |
| Erro (texto sobre tinta `#FEE2E2`) | `#B91C1C` |
| Fonte de display | Manrope 700/800 |
| Fonte de corpo | Inter 400/500/600 |
| Raio | `0.75rem` cards · pill nos badges |
| Sombra | azulada, ~10% opacidade, discreta |
| Densidade | confortável (linhas de agenda com respiro) |

## 2 · Âmbar Estúdio

Acolhedor, boutique — mira o segmento de salão/estética especificamente
(sidebar escura quente, título serifado). Mais "identidade de marca", menos
"software corporativo".

| Token | Valor |
|---|---|
| Primária (ajustada para AA em botão branco/primária — a original `#C99A5B` não passa em texto) | `#8A5423` |
| Acento decorativo (não usar como texto pequeno — 2.54:1) | `#C99A5B` |
| Sidebar | `#1C1410` |
| Texto | `#241A14` |
| Texto secundário | `#7A5230` |
| Fundo | `#FBF4EC` |
| Borda | `#EAD9C2` |
| Sucesso (texto sobre tinta `#E8F3EC`) | `#2A6B45` |
| Erro (texto sobre tinta `#FBE7E2`) | `#B4432E` |
| Fonte de display | Fraunces 600/700 (serifada) |
| Fonte de corpo | Inter 400/500/600 |
| Raio | `1.25rem` cards |
| Sombra | âmbar, ~16% opacidade, mais alta/presente |
| Densidade | relaxada (padding maior, ar entre blocos) |

## 3 · Verde Slate

Ultra minimalista e denso, para quem opera o painel o dia inteiro (recepção
com várias abas abertas). Quase sem sombra — o contorno faz o trabalho.

| Token | Valor |
|---|---|
| Primária | `#2F6B4F` |
| Primária 700 | `#1F4A36` |
| Texto | `#16241C` |
| Texto secundário | `#3F5B4C` |
| Fundo | `#F7F9F7` |
| Borda | `#DCE5DE` |
| Alerta (texto sobre tinta `#FBEEDB`) | `#8A5A00` |
| Erro (texto sobre tinta `#FBE6E4`) | `#B3261E` |
| Fonte de display | Sora 600/700 |
| Fonte de corpo | Inter 400/500/600 |
| Raio | `0.5rem` |
| Sombra | quase nenhuma (`0 1px 2px rgb(22 36 28 / 0.05)`) |
| Densidade | compacta (mais linhas visíveis por tela) |

## O que cada mockup mostra

- Sidebar (desktop) / topbar com hambúrguer (mobile, < 1024px) com a
  navegação completa do painel (Agenda, Agendamentos, Serviços,
  Profissionais, Clientes, WhatsApp, Configurações — nomes batem com
  `docs/arquitetura.md` §9).
- **Agenda do dia**: colunas por profissional (Ana, Carla, Bianca), blocos de
  horário ocupados vs. disponíveis, card lateral "Próximos agendamentos".
  Em telas estreitas, a grade de profissionais rola horizontalmente dentro do
  próprio card (padrão comum de agenda — não é overflow acidental; confirmado
  que o `body` não estoura em nenhuma das duas larguras testadas).
- **WhatsApp**: card de número conectado (status, telefone, "conectado há X
  dias", desconectar) e card de número desconectado com área de QR e botão
  "Conectar número".

## Verificação feita

- Playwright, headless, servindo o HTML por `http.server` (não `file://`).
- Larguras: 1440px (desktop) e 390px (mobile).
- Confirmado: sem overflow horizontal do `body` em nenhuma direção/largura;
  sidebar oculta e hambúrguer visível abaixo de `lg` (1024px); os três
  seletores alternam a direção visível corretamente.
- Contraste calculado via fórmula de luminância relativa do WCAG para todos
  os pares texto/fundo usados (não estimado por leitura do hex).

## Pendência

Este HTML é só a proposta de direção — nenhum código foi criado em `src/`.
A Vega segue com o esqueleto do painel em paralelo; a direção escolhida pelo
dono deve ser repassada a ela e à Lyra antes da Fase 2 (Catálogo e agenda),
que é quando as telas reais de Agenda/WhatsApp entram em construção
(`docs/arquitetura.md` §13).
