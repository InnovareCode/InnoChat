---
name: csv_injection_pushname
description: Achado IMPORTANTE 2026-09-29 — exportContactsCsvAction vulnerável a CSV formula injection via pushName do WhatsApp (fonte externa não autenticada)
metadata:
  type: project
---

Na revisão incremental de 2026-09-29 (`docs/seguranca/revisao-incremental-2026-09-29.md`),
encontrei que `csvEscape` (`src/modules/contacts/contacts.ts:370-375`, usado por
`exportContactsCsv`/`exportContactsCsvAction`) só escapa aspas/`;`/quebra de linha — não
neutraliza valores que COMEÇAM com `=`, `+`, `-`, `@` (clássico CSV Injection/formula injection,
OWASP). A primeira coluna do CSV é `displayName`, que cai em `pushName` quando o contato não tem
`name` cadastrado pelo dono (`computeDisplayName`) — e `pushName` é o nome de perfil do WhatsApp,
gravado por `src/modules/bot-api/claim.ts` a partir do que a Evolution reporta, ou seja,
**controlado por qualquer pessoa que mande mensagem no WhatsApp da empresa, sem autenticação**.
Um atacante pode setar o nome de perfil como `=HYPERLINK(...)` e, quando o OWNER exportar e abrir
no Excel, vazar dados de outras colunas ou (Excel legado com DDE) executar comando no SO do dono.

**Correção proposta (não implementada — é para Vega):** em `csvEscape`, se o valor começar com
`=`, `+`, `-`, `@`, tab ou CR, prefixar com apóstrofo (`'`) ANTES do escape de aspas atual.

**Padrão a vigiar em qualquer exportação/relatório futuro deste projeto:** qualquer texto que
tenha entrado via WhatsApp (pushName, mensagem, futura nota livre) e vá para CSV/planilha precisa
passar por essa neutralização — o WhatsApp é a única fonte de texto no sistema que não passa por
nenhum login/validação de conteúdo antes de existir num `Contact`.

Ver também [[tenant_isolation_pattern]].
