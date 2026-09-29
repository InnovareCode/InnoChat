---
name: ui-tipada-contra-contrato-antes-do-backend
description: Como validar (lint/typecheck/build) uma UI construída contra um contrato de Server Actions cujo arquivo real ainda não existe, sem poluir o território de outro agente.
metadata:
  type: feedback
---

Quando o Atlas passa um contrato fixado de Server Actions que a Vega ainda não implementou
(ex.: `src/modules/contacts/actions.ts`), a UI pode e deve ser escrita já importando dessas
assinaturas exatas — os imports simplesmente não resolvem até o arquivo real existir.

**Como validar mesmo assim:** escrevo um stub temporário nesse mesmo caminho (funções que só
fazem `throw`, com as assinaturas e tipos exatos do contrato), rodo `tsc --noEmit` + `lint` +
`build` contra ele, e **apago o stub inteiro em seguida** (`rm -rf` do diretório que criei,
confirmado com `git status`/`ls`). Isso prova que a minha metade do contrato está certa sem
nunca deixar um arquivo fantasma no diretório que é da Vega (`src/modules/**` não é meu).

**Por quê:** sem isso, ou eu declarava "compila" sem nunca ter rodado o compilador (proibido
pela [[handoff-da-equipe]]), ou esperava a Vega terminar pra só então descobrir erro de tipo
meu — perdendo o paralelismo que era o ponto de ela estar trabalhando ao mesmo tempo.

**Como aplicar:** sempre que a tarefa depender de um arquivo de outro agente que ainda não
existe, fazer esse ciclo (criar stub → validar → apagar → confirmar limpo) antes de reportar
"compila", e deixar claro no handoff que a validação foi contra um espelho do contrato, não
contra o código real da Vega — a Íris/Atlas ainda precisam validar de novo quando o arquivo
dela entrar.
