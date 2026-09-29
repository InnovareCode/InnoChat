---
name: dnd-kit-drag-testing
description: Como testar arrastar-e-soltar do dnd-kit na Agenda (mouse simulado) e por que checar o RESULTADO no banco, não a posição exata no DOM
metadata:
  type: project
---

`src/app/(app)/[tenantSlug]/agenda/agenda-client.tsx` usa `@dnd-kit/core` (`PointerSensor` com
`activationConstraint: { distance: 8 }`, sem `collisionDetection` customizado — usa o padrão da
lib, `rectIntersection`, sobre o retângulo ARRASTADO, não o ponto do ponteiro).

**Como simular o arraste no Playwright:** `dragTo()` do Playwright não dispara os eventos de
pointer que o dnd-kit escuta — usar `page.mouse.move/down/move(steps)/up` manualmente. Um passo
pequeno (~12px) logo após o `mouse.down()` é necessário para vencer o `activationConstraint`
antes do passo final até o alvo.

**A grade rola por DENTRO** (`overflow-auto` num `Card` de altura fixa) — sem
`target.scrollIntoViewIfNeeded()` antes de ler `boundingBox()`, as coordenadas calculadas caem
fora da área realmente pintada e o mouse não acerta nada (sem erro, só silenciosamente não
funciona).

**Não afirme o slot EXATO de pouso quando o agendamento dura mais de 30min** (ocupa 2+ linhas):
como a colisão compara o retângulo ARRASTADO (não o ponteiro) contra as células, mirar o centro
de uma célula-alvo com um cartão de 60min pode pousar na célula vizinha (achado ao rodar este
teste a primeira vez — mirar "11:00" pousou em "10:30"). Teste "saiu de onde estava, e o toast de
sucesso apareceu" em vez do pixel exato — isso já prova o contrato sem testar o algoritmo de
colisão de uma lib de terceiros.

**Para os casos de "reverte" (soltar em bloqueio/fora do expediente/outro profissional), confira
o BANCO (`prisma.appointment.findUnique`), não o DOM.** O card pode ficar fora da área visível
rolada sem que isso signifique que ele mudou de lugar — checar `startsAt`/`professionalId` antes
e depois do arraste é a fonte de verdade, imune a onde a rolagem interna do container deixou o
scroll.

**Bloqueio de teste largo e longe de agendamentos existentes:** um bloqueio de só 1h pode ficar
"escondido" atrás de um agendamento pré-existente do seed (ex.: 13h) na mesma célula, e ±1 linha
de imprecisão da colisão pode escapar de uma janela estreita. Usar uma janela de 1h30 num horário
sem nada mais agendado evita ambos os problemas.

Ver também [[bugs_found_log]] — o alerta "precisa de atenção" no menu (ponto vermelho do
WhatsApp) fica invisível quando o grupo colapsável da nav ("Canal") não está aberto, porque o
`NavRow` (onde o ponto é renderizado) só existe no DOM quando o grupo está expandido.
