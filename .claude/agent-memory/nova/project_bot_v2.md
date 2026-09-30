---
name: project-bot-v2
description: Bot v2 (spec + plano 2026-09-30) — motor TS compilado nos Code nodes, só texto, grade em slotGranularityMin, HandoffRequest, limite só com header v2, Publicar fluxo
metadata:
  type: project
---

Fontes: `docs/bot-v2-especificacao.md` (comportamento, CA-01..47, §11 com os 17 bugs) e
`docs/bot-v2-plano.md` (contratos exatos §3, posse de arquivos §6, deploy/rollback §5).

Decisões não óbvias (e o porquê):
- **Motor puro em `src/core/bot/engine/`, compilado (esbuild IIFE `InnoEngine`) para os nós
  `Interpretar` e `Montar mensagem`** entre `/* @engine:begin|end */`. Substituiu a ideia antiga de
  `hints` calculadas no claim: mesmo código testado no Vitest, no simulador e no n8n. Transições
  continuam em Switch/IF visíveis (decisão do dono de fluxo editável). Relógio vem do claim
  (`tenant.today/nowLocal`), motor sem Intl de fuso.
- **Só texto** (P1: botões somem, lista 400 na Evolution 2.3.7). Removidos optionId/promptSeq/
  botInteractive/OutMessage. Ver [[project-evolution-baileys-limites]].
- **Grade reaproveita `Tenant.slotGranularityMin`** (15|30, padrão 30, ancorada na meia-noite
  local) em vez de `slotStepMinutes` pedido pelo Atlas — seria campo gêmeo.
- **Duas pastas de migration** (schema, depois porta de textos): `ALTER TYPE ADD VALUE` não pode ser
  usado na mesma transação.
- Atendente: tabela `HandoffRequest` (índice único parcial, 1 aberto por sessão); pausa de
  `handoffResumeMinutes` (120); "menu" só devolve o bot se reason=CLIENT_REQUEST; fromMe da equipe
  estende para humanPauseMin sem `Contact.botPausedUntil`. Sino derivado da tabela.
- Limite de agendamentos (padrão 3) só vale com header `X-InnoChat-Flow: 2`: o v1 não sabe mostrar
  o 422 (o "Resultado reserva" v1 trata 4xx genérico).
- BUG-04: o **release** do painel envia `TECH_ERROR` quando a trava ainda era da execução morta;
  `innochat-erros` não muda (depende dos nós `Claim` e `Config`).
- Rollback do fluxo: opções v2 também gravam `label` para o `Interpretar` v1 ler a sessão; estados
  novos caem na lista `KNOWN` do v1 → menu.
- Simulador (`scripts/bot-sim/engine.mjs`) só executa alguns tipos de nó/operadores: o workflow v2
  tem de caber neles (plano §3.7).

**Why:** dono pediu fluxo robusto; auditoria da Íris achou 17 bugs; decisões do dono em spec §12.4.
**How to apply:** mudança de contrato do bot passa pela spec/plano; nunca mudar webhookId/path do
Webhook nem do `Esperar`; texto novo exige padrão v2 + variáveis permitidas por chave.
