---
name: bug-dialog-dentro-de-renderizacao-condicional
description: Diálogo cujo próprio gatilho vive dentro de um bloco que a ação do diálogo faz desmontar (ex. EmptyState) perde o passo final — causa raiz e como evitar em componentes novos.
metadata:
  type: project
---

Bug real (achado pela Íris em `tests/e2e/whatsapp.spec.ts`, corrigido 2026-09-28):
`whatsapp-client.tsx` tinha DOIS pontos de montagem de `ConnectWhatsappDialog`
(um dentro do `EmptyState`, quando `instances.length === 0`; outro no
`PageHeader`, quando `hasInstances`). O próprio `onConnected` do diálogo
atualizava a lista para deixar de estar vazia — o que desmontava o `EmptyState`
(e o diálogo aberto dentro dele) no mesmo instante em que a conexão terminava.
Resultado: ao conectar o 1º número, o passo "Número conectado" nunca aparecia
(o componente já tinha sumido). Do 2º número em diante não acontecia, porque
o diálogo já vivia no cabeçalho, que não desmonta.

**Causa raiz:** um componente com estado interno relevante (aqui, o próprio
diálogo de conexão, com seu `step`/polling) não pode ter seu ciclo de vida
amarrado a uma condição que a AÇÃO DELE MESMO pode mudar. Se o dado que decide
"onde/se este componente está montado" é atualizado pelo próprio componente,
existe risco de self-unmount no meio de uma operação assíncrona.

**Correção aplicada:** o `open` (e só o `open`) subiu para o componente pai
(`whatsapp-client.tsx`), como estado controlado — `ConnectWhatsappDialog` ganhou
props opcionais `open`/`onOpenChange` (fallback para `useState` interno quando
omitidas, então o onboarding — que só tem UM ponto de montagem — não mudou
nada). Agora existe **uma única instância** do diálogo, montada sempre, fora
de qualquer condicional de lista; os dois lugares visuais (header/EmptyState)
viraram apenas botões burros que chamam `setConnectOpen(true)`.

**Como aplicar em componentes novos:** ao ver `{condição ? <X/> : <Y/>}` onde
X ou Y tem estado interno relevante (formulário em andamento, diálogo com
polling, wizard), perguntar: "a ação de X/Y pode mudar essa condição?". Se sim,
o estado de abertura precisa subir para fora da condicional — nunca deixar o
próprio componente cavar a cova em que vai cair.

Ver também [[sistema-de-temas-tailwind-v4]] para outros padrões de estado do
projeto.
