---
name: inno-animado-rosto-led
description: Como o Inno animado (InnoAnimated) foi montado: rosto de LED em SVG alinhado ao PNG, fala com máquina de escrever, armadilhas medidas.
metadata:
  type: project
---

`src/components/onboarding/inno-animated.tsx` é o único componente do mascote (avatar/full). Dados puros em `inno-face.ts`
(coordenadas medidas por componentes conexos de pixels ciano: full olhos (148.4,203.8)/(209.2,195.8) r11.5, boca (183.1,231.7);
avatar 192px olhos (58.4,98.3)/(98.8,93.0) r7.6), fala em `typewriter.ts` (reducer) + `use-inno-speech.ts` + `inno-speech-text.tsx`.

- SVG com viewBox = tamanho do PNG e `absolute inset-0` sobre a imagem: casa exato em qualquer tamanho (delta 0 medido de 44 a 373 px).
- Tela do robô é inclinada -7,5°: olhos/boca giram juntos. Cobrir o original com elipse de tela escura + gradiente radial (borda transparente);
  a elipse da boca precisa ser rotacionada e larga (rx 25) senão sobra a ponta do sorriso original.
- Todas as bocas com a MESMA estrutura de curvas Bezier, senão framer não interpola `d`.
- Hook de fala tem `onceKey` (sessionStorage): checklist/parabéns só animam 1ª vez por sessão. Cada estado (progresso x parabéns) é componente
  próprio: se o hook ficar num pai que renderiza ambos, o "uma vez" é gasto sem ninguém ver.
- Texto visível = trecho digitado + resto `opacity-0` (reserva altura, balão não cresce); texto final em `sr-only`.
- Dev server compartilhado com Prisma velho quebra o layout (PrismaClientValidationError): validar em `next build` + `next start -p 3600`.
- Passos do tour só podem ter alvo `data-tour` no shell (páginas internas não existem quando o tour abre); teste unitário confere todos os alvos.
