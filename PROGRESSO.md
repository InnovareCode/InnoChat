# InnoChat — Progresso

Chatbot de agendamento via WhatsApp (n8n + Evolution API) com painel web
multiempresa para clínicas, salões e qualquer negócio de serviços com horário marcado.

## Estado atual
- 2026-09-28 — Marco zero. Decisões iniciais fechadas com o dono; Nova desenhando arquitetura e plano faseado.

## Decisões fechadas (2026-09-28)
- Produto **separado** do InnoAtendente (reaproveita lições e padrão visual, não código/banco).
- **Multiempresa (SaaS)**: cada empresa com login, agenda, serviços e WhatsApp próprios; um único conjunto de workflows no n8n para todas.
- Conversa por **menu guiado** (sem IA).
- Infra: **VPS atual com Easypanel** + Evolution API já existente. n8n conectado via MCP (vazio no início).

## Concluído
- Repositório git iniciado; projeto registrado no Painel de Tarefas (PM-AVAN, slug `innochat`).

## Próximos passos
- Nova: arquitetura, stack, contrato painel↔n8n↔Evolution e plano faseado.

## Decisões em aberto
- (nenhuma ainda)
