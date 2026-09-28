# InnoChat — Progresso

Chatbot de agendamento via WhatsApp (n8n + Evolution API) com painel web
multiempresa para clínicas, salões e qualquer negócio de serviços com horário marcado.

## Estado atual
- 2026-09-28 — Arquitetura aprovada e revisada (`docs/arquitetura.md`: fases na §13, decisões na §15).
  Em andamento, em paralelo: Vega (esqueleto), Cronos (schema + EXCLUDE), Lyra (3 direções visuais para o dono escolher).
- Segunda rodada de decisões: menu nos nós do n8n; cadastro público + cobrança (Mercado Pago Pix); lembrete pós-v1; sem histórico de conversa na v1.

## Decisões fechadas (2026-09-28)
- Produto **separado** do InnoAtendente (reaproveita lições e padrão visual, não código/banco).
- **Multiempresa (SaaS)**: cada empresa com login, agenda, serviços e WhatsApp próprios; um único conjunto de workflows no n8n para todas.
- Conversa por **menu guiado** (sem IA).
- Infra: **VPS atual com Easypanel** + Evolution API já existente. n8n conectado via MCP (vazio no início).

- 2026-09-28 (tarde): esqueleto (Vega) e schema com EXCLUDE provado (Cronos) entregues e commitados.
  Em andamento: Lyra (temas por empresa, kit UI, shell, login, admin shell) ∥ Vega (admin da plataforma, core/agenda, Server Actions, contratos).

- 2026-09-28 (noite): Fases 2 (telas + polimento), 4 (API do bot) e 7 (cobrança backend) commitadas; bot bloqueado por assinatura ligado.
  Em andamento: workflow n8n (Fase 5), exceções na Agenda (Lyra). Próximo: Íris (QA E2E com Playwright), Órion (revisão), Fase 3 (QR) e deploy dependem das credenciais do dono.
  Pendências técnicas: validar assinatura do webhook MP contra a doc oficial/sandbox real; fixtures da Evolution ainda não capturadas do servidor real.

## Concluído
- Repositório git iniciado; projeto registrado no Painel de Tarefas (PM-AVAN, slug `innochat`).

## Próximos passos
- Nova: arquitetura, stack, contrato painel↔n8n↔Evolution e plano faseado.

## Decisões em aberto
Pendentes com o dono (§15 da arquitetura):
1. 🔑 Evolution (versão, URL, chave global), URL do n8n (mesma rede do Easypanel?), domínio do painel.
2. Preços dos planos (adiado pelo dono; limites JÁ aprovados: Essencial 1 número/3 profissionais, Profissional 2/10, Clínica 3/ilimitado). Preço fica editável no admin de Planos, sem valor fixo no código.
3. Credenciais do Mercado Pago (produção + sandbox).
4. Dados do SMTP próprio (host, porta, usuário, senha, remetente).
5. Termos de uso e política de privacidade.
6. Direção visual (Lyra vai apresentar 3).

Fechadas em 2026-09-28: Mercado Pago (Pix) confirmado; e-mail por SMTP próprio; trial de 1 dia; carência de 1 dia; sem nota fiscal.
