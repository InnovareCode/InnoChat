---
name: project-evolution-baileys-limites
description: Limites da Evolution API v2/Baileys pesquisados em 2026-09-28 — botões/listas/enquete não confiáveis; @lid quebra resposta
metadata:
  type: project
---

Pesquisa de 2026-09-28 (fontes citadas em docs/arquitetura.md §3 e §6.3):
- Botões e listas interativas: não suportados no conector Baileys (só Cloud API); regressões em 2.2.3/2.3.0
  (lista não chega) e 2.3.7 (HTTP 400, issue fechada "not planned"). Enquete: voto chega sem a opção.
  → menu é SEMPRE lista numerada em texto.
- @lid: remetente pode chegar como `NNN@lid`; responder para @lid dá 400 `exists:false`. Usar
  `remoteJidAlt`/`senderPn`. Issue guarda-chuva #1872 ainda aberta em abr/2026.

**Why:** decisões de formato e de normalização dependem disso; é fácil alguém "tentar botões" de novo.

**How to apply:** antes de reconsiderar interativo, reverificar o estado atual (pode mudar com versão).
Qualquer mudança de versão da Evolution exige rodar as fixtures reais da Fase 0.
