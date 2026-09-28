---
name: licao-nao-portar-visual-sem-numeros
description: Lição herdada do InnoAtendente (projeto irmão) — nunca descrever direção visual só com adjetivos; usar números (hex, raio, opacidade de sombra) e confirmar contra tela real renderizada, não código lido
metadata:
  type: feedback
---

No projeto irmão InnoAtendente, portar "o padrão visual" de outro produto
usando só adjetivos ("moderno", "sofisticado") custou 6 rodadas de retrabalho
— a primeira passada acertou a estrutura mas errou o peso visual (raio,
sombra tingida, fonte de título separada da de corpo, motion, barra fixa).
Detalhe completo em
`C:\Users\Personal Computer\.claude\projects\C--Projetos-Web-InnoAtendente\memory\licao-porte-visual-superficial.md`.

**Why:** pedidos como "clean e profissional" ou "seguir o padrão de X" são
ambíguos o bastante para virar 6 idas e vindas se a primeira entrega não tiver
números defensáveis por trás.

**How to apply neste projeto (InnoChat):**
- Ao propor ou ajustar visual, sempre falar em hex/rem/opacidade concretos,
  nunca só em adjetivo — ver [[direcao-visual-proposta]] como exemplo do que
  ficou registrado.
- O pedido do dono aqui foi **minimalista/clean**, o oposto do visual carregado
  que ele validou no InnoAtendente — não copiar densidade/peso de lá, só usar
  aquelas lições como sinal de "o que comunica acabamento" (fonte de título
  separada, sombra tingida em vez de cinza neutro, nada de `max-w` sobrando
  espaço), adaptado para um resultado mais enxuto.
- Sempre medir no navegador antes de declarar pronto (skill
  `medir-antes-de-afirmar`) — não confiar em leitura de CSS.
