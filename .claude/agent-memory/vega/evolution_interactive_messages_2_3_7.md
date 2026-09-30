---
name: evolution-interactive-messages-2-3-7
description: Como a Evolution 2.3.7 envia/recebe botões, lista e enquete (lido do código-fonte, NÃO provado em aparelho) e o risco do eco fromMe pausar o bot
metadata:
  type: project
---

Fonte: código da tag 2.3.7 (raw.githubusercontent.com/EvolutionAPI/evolution-api/2.3.7/...), acessível por curl no Bash. Doc completa em `docs/whatsapp-botoes-listas.md`.

- sendButtons = `viewOnceMessage>interactiveMessage>nativeFlow quick_reply` (≤3 reply); sendList = `listMessage` legado; sendPoll = enquete nativa.
- Resposta de botão nativo chega como `interactiveResponseMessage.nativeFlowResponseMessage.paramsJson` (JSON string com `id`), NÃO como `buttonsResponseMessage`.
- Voto de enquete só vem decifrado (`data.pollUpdates`, `vote.selectedOptions` = nomes) se a Evolution achar a enquete na tabela `Message` dela (`DATABASE_SAVE_DATA_NEW_MESSAGE`).
- **Armadilha:** eco `fromMe` de mensagem interativa é "mídia" no `claim` → não bate `recentOutbound` (só texto) → pausa o bot do contato (humanPauseMin). Bot v2 precisa registrar o eco antes de enviar interativo.
- `evolutionRequest` agora tem `evolutionRequestFull` (status+corpo) e `EvolutionApiError.responseBody` (nunca em log).
- Normalizer desembrulha `ephemeralMessage`/`viewOnce*` (antes texto em chat temporário virava mídia).
- Shell: `sed` com crases dentro de aspas simples em heredoc grande derrubou o comando inteiro em silêncio (nada foi escrito) — usar Write.
