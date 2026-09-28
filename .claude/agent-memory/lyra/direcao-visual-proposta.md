---
name: direcao-visual-proposta
description: Três direções visuais do InnoChat foram propostas em docs/design/direcoes.html antes de qualquer tela real, aguardando escolha do dono
metadata:
  type: project
---

Em 2026-09-28 entreguei `docs/design/direcoes.html` (+ `docs/design/direcoes.md`
com a tabela de tokens) com 3 direções visuais completas para o InnoChat —
cada uma com paleta, par tipográfico, raio/sombra/densidade e a mesma tela de
Agenda do dia + recorte de WhatsApp renderizados:

1. **Índigo Clínico** — institucional, azul, Manrope+Inter, `rounded-xl`,
   sombra azulada sutil, densidade confortável.
2. **Âmbar Estúdio** — boutique/salão, terracota + sidebar escura, Fraunces
   (serifada) + Inter, `rounded-2xl`, sombra âmbar mais presente, densidade
   relaxada.
3. **Verde Slate** — ultra minimalista/denso, verde-sálvia, Sora + Inter,
   `rounded-lg`, quase sem sombra, densidade compacta (para operação o dia
   inteiro).

**Why:** nenhuma tela real (`src/`) foi construída ainda — o pedido do dono
foi "minimalista, organizado, profissional, clean, intuitivo, robusto", que é
ambíguo o suficiente para dar errado sem calibração prévia (ver
[[licao-nao-portar-visual-sem-numeros]]). As três direções têm números
concretos (hex, rem, opacidade de sombra), não adjetivos.

**How to apply:** antes de construir a tela real de Agenda/WhatsApp
(`docs/arquitetura.md` §13, Fase 2/3), confirmar com o Atlas/dono qual das
três direções foi escolhida (ou que mistura) e atualizar esta memória com a
decisão. Repassar a paleta e tipografia escolhida para a Vega não é
necessário (ela não mexe em UI), mas é necessário para qualquer outro agente
de frontend que pegar o trabalho depois de mim.
