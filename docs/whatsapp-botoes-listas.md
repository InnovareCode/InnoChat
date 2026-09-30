# Botões, listas e enquetes no WhatsApp (bot v2)

Pergunta do dono: as opções do bot podem aparecer **em botões** em vez de texto numerado?

> **Estado da prova.** Tudo abaixo sobre o que a Evolution 2.3.7 faz vem da leitura do **código-fonte
> da tag `2.3.7`** (`EvolutionAPI/evolution-api`, arquivos `whatsapp.baileys.service.ts`,
> `sendMessage.dto.ts`, `message.schema.ts`, `CHANGELOG.md`; Baileys `7.0.0-rc.9`). **Nenhum payload
> foi capturado de um aparelho real** e a renderização no WhatsApp **não foi provada**. O que o
> WhatsApp mostra no celular do cliente (e se o clique/voto volta no webhook nesse formato) só o
> teste real do dono confirma. As afirmações marcadas "relato da comunidade" não foram verificadas.

## 1. O que a Evolution 2.3.7 promete

Três endpoints, todos `POST /message/<nome>/{instance}` com header `apikey`, corpo com `number`
(dígitos com DDI, ex. `5511912345678`) e resposta `201` com `key.id` (Baileys).

| Endpoint | Payload | Como sai no WhatsApp (código) |
|---|---|---|
| `sendButtons` | `{ number, title, description?, footer?, buttons: [{ type: "reply", displayText, id }] }` — até **3** botões `reply`; não mistura com `url`/`call`/`copy`; 1 botão `pix` sozinho | `viewOnceMessage > interactiveMessage > nativeFlowMessage` com botões `quick_reply` (o **título** vira negrito no corpo) |
| `sendList` | `{ number, title, description?, footerText?, buttonText, sections: [{ title, rows: [{ title, description?, rowId }] }] }` — `title` de linha/seção e `rowId` obrigatórios; `description` se enviada não pode ser vazia | `listMessage` (formato **legado**) com `listType: 2` |
| `sendPoll` | `{ number, name, selectableCount (0–10), values: [2 a 10 únicos] }` | `pollCreationMessage` (enquete nativa) |

Limitações que o próprio repositório indica:

- `CHANGELOG`: "**Deprecate buttons and list in new Baileys version**" (versão 6.7.6 do Baileys). A
  2.3.x reintroduziu botões via `interactiveMessage`/`nativeFlow`, mas o `listMessage` continua o
  legado.
- Relato da comunidade (não verificado aqui): botões/listas/`nativeFlow` enviados por conta **não
  oficial** (WhatsApp Web/Baileys) frequentemente **não aparecem** no aparelho do cliente, ou
  aparecem só em parte dos aparelhos/versões (iPhone é o caso mais citado). Isto é o que o teste do
  dono precisa decidir.
- **Enquete** é mensagem nativa do WhatsApp (não interativa proprietária): a expectativa é
  renderizar em Android e iPhone. Limites: máx. 10 opções; no chat individual o cliente vota e
  pode trocar/remover o voto.

## 2. Como a resposta (clique / escolha / voto) chega no webhook

Sempre em `messages.upsert`, dentro de `data.message`:

| Envio | O que vem de volta | Campo lido |
|---|---|---|
| Botões (`sendButtons`) | `interactiveResponseMessage.nativeFlowResponseMessage.paramsJson` = JSON string `{"display_text":"Corte","id":"1"}` | `id` |
| Botões legados | `buttonsResponseMessage.selectedButtonId` (ou `templateButtonReplyMessage.selectedId`) | id do botão |
| Lista | `listResponseMessage.singleSelectReply.selectedRowId` | `rowId` |
| Enquete | `pollUpdateMessage` (voto **cifrado** pelo WhatsApp). A Evolution **decifra** e devolve nomes em `data.message.pollUpdateMessage.vote.selectedOptions` e em `data.pollUpdates` (`[{ name, voters }]`) | nome da opção marcada |

**Enquete — o que precisa ser verdade para o voto ser legível** (código `whatsapp.baileys.service.ts`
linhas ~1206–1303):

1. A Evolution precisa achar a **mensagem original da enquete no banco dela** (`getMessage` lê a
   tabela `Message`). Se `DATABASE_SAVE_DATA_NEW_MESSAGE` estiver desligado no servidor da Evolution,
   a enquete não é encontrada e o voto chega **cifrado** (`encPayload`/`encIv`, sem nomes).
2. Precisa do `messageSecret` guardado dessa enquete (é gravado junto quando a Evolution envia).
3. Depende de tentar combinações de JID (`@lid` x número) — houve várias correções de `@lid` nessa
   área na 2.3.x; pode falhar em casos raros.

Decifrar por conta própria (com o `messageSecret`) **não é suportado** por nós: se o voto chegar
cifrado, o normalizador o trata como "resposta interativa ilegível" (vira mídia → o bot responde o
aviso padrão "só texto"), nunca fica mudo. Voto **removido** (nenhuma opção marcada) também cai aí.

Efeito colateral importante: o **eco** da nossa própria mensagem interativa volta como `fromMe`
(`interactiveMessage`/`listMessage`/`pollCreationMessage`), que o `claim` hoje classifica como
"mídia" e, por não bater com `ChatSession.recentOutbound` (só texto), **pausa o bot do cliente por
`humanPauseMin`** ("humano assumiu"). Vale igual para o teste do admin se o número testado for um
cliente cadastrado, e **é requisito do bot v2**: o envio interativo do bot precisa registrar o eco
(ex.: por `key.id` da mensagem enviada ou por hash de um texto-marcador) antes do envio, igual ao
lembrete (`registerOutboundEcho`).

## 3. O que o código faz agora

- `src/modules/whatsapp/evolution-client.ts`: `sendButtons`, `sendList`, `sendPoll`. Uma tentativa
  só (sem retry — reenviar duplicaria). Devolvem `{ messageId, status, body }`. Em erro,
  `EvolutionApiError.responseBody` guarda o corpo do erro (**não** entra em log/mensagem).
- `src/core/bot/evolution-normalize.ts`: transforma cada resposta acima no **texto equivalente** (o
  `id`/`rowId`, ou, na enquete, o número no início do nome: `"1 - Corte"` → `1`; sem número usa o
  nome). O motor do n8n não muda. Também passou a **desembrulhar** `ephemeralMessage`/`viewOnce*`
  (chat com mensagens temporárias): antes, texto digitado nesses chats virava "mídia".
- Testes: `evolution-client.test.ts` (payloads), `evolution-normalize.test.ts` (respostas). Os
  payloads de resposta são **montados a partir do código/protos, não capturados de aparelho**.
- **Teste do admin:** Admin → Saúde → card "Teste de botões do WhatsApp". Action
  `sendInteractiveTestAction({ instanceId | tenantSlug, to, kind: "buttons"|"list"|"poll" })`
  (`src/modules/whatsapp/interactive-test-actions.ts`): só admin da plataforma, 10 envios/min,
  só instância `CONNECTED` **não sandbox**, número BR validado e **não guardado** (nem em log; no
  resultado aparece só `***5678`). Manda "Qual serviço você quer?" com Corte · Escova · Coloração
  (ids `1`,`2`,`3`) e mostra status HTTP e corpo da Evolution.

## 4. Roteiro do teste no celular (Android e iPhone)

Use um número **que não seja cliente cadastrado** da empresa (senão o bot dele pausa, ver §2).

Para cada aparelho (mínimo: 1 Android + 1 iPhone, WhatsApp comum e, se puder, WhatsApp Business):

1. Admin → Saúde → card de teste; escolha o número conectado; digite o **seu** celular.
2. Toque **Enviar botões**. Anote: (a) status/corpo da Evolution; (b) no celular apareceu: botões
   clicáveis / texto sem botões / mensagem vazia ou "atualize o WhatsApp" / nada?
3. Se apareceram botões: toque em **Escova**. No n8n/`InboundEvent` o texto recebido deve ser `2`.
4. Repita com **Enviar lista** (abre "Ver opções"? escolher **Coloração** deve chegar como `3`).
5. Repita com **Enviar enquete** (votar em **1 - Corte** deve chegar como `1`; trocar o voto e
   remover o voto também vale testar). Se o voto não chegar como número/nome, veja se veio
   cifrado (§2, item 1).
6. Teste também com o celular **em outra conta/linha nova** (contato que nunca falou com o número),
   pois a exibição pode mudar entre contato conhecido e desconhecido.

Cole de volta: aparelho + versão do WhatsApp + o que apareceu para cada um dos três.

## 5. Recomendação preliminar (a final depende do teste do dono)

1. **Manter texto numerado como padrão** — funciona em qualquer aparelho e é o que está provado.
2. **Enquete é a candidata a "opção clicável"** (mensagem nativa, não depende do formato
   interativo proprietário), **se** o voto chegar decifrado no servidor real; exige confirmar
   `DATABASE_SAVE_DATA_NEW_MESSAGE` na Evolution de produção. Limite de 10 opções e voto que pode
   ser trocado pedem tratamento (só reagir ao 1º voto, ignorar remoção).
3. **Botões e lista: só adotar se aparecerem em Android e iPhone** no teste. Se falharem em qualquer
   um, não usar (cliente vê mensagem vazia = bot "mudo" para ele), ou usar com **texto numerado
   junto** como fallback.
4. Em qualquer caso, o bot v2 deve enviar o **texto numerado como base** e tratar botão/lista/enquete
   como *acréscimo*, e registrar o eco `fromMe` do envio interativo (§2).
