# InnoChat — Progresso

Chatbot de agendamento via WhatsApp (n8n + Evolution API) com painel web multiempresa
para clínicas, salões e qualquer negócio de serviços com horário marcado.
Repositório: https://github.com/InnovareCode/InnoChat (branch `main`).
Decisões do dono: memória `decisoes-iniciais-innochat` e `docs/arquitetura.md` §15.

## Estado atual (2026-09-28)

Produto funcional localmente, **ainda não publicado**. Em andamento: protótipo premium
(4 pacotes de melhoria + responsividade, Lyra) e alinhamento do Mercado Pago ao
adaptador validado do Parque das Feiras (Vega).

## Concluído

- **Painel da empresa:**
  - Início com indicadores e gráfico;
  - Agenda dia/semana, com folgas e bloqueios;
  - Agendamentos, Serviços, Profissionais (expediente e folgas);
  - **Clientes** (ficha, pausar o bot, LGPD, CSV);
  - **WhatsApp por QR**;
  - Mensagens do bot;
  - Configurações (3 temas, bloqueios da empresa, equipe);
  - Assinatura (Pix, troca de plano);
  - onboarding.
- **Contas:** cadastro público, confirmação de e-mail com reenvio, esqueci a senha, convite de equipe, instalação única do admin.
- **Admin da plataforma:**
  - Configurações: Evolution, n8n, SMTP, Mercado Pago, testar conexão, sincronizar n8n, ativar bot;
  - Planos (R$ 59,90 / 109,90 / 189,90, editáveis);
  - Empresas.
- **Backend:** API interna do bot, cobrança Pix + `billing/tick`, LGPD `maintenance/tick`, adaptador Evolution, segurança (rate limit, headers/CSP, SSRF, assinatura do MP).
- **n8n (inativos até publicar):** `innochat-bot` (agendar, meus agendamentos, cancelar, remarcar), `innochat-erros`, `innochat-cron`.
- **Qualidade:** 171 unitários, 118 de integração, ~60 E2E, revisão de segurança, CI, Dockerfile + `/api/health`, guia `docs/deploy-easypanel.md`.

## Falta antes de publicar

1. Protótipo premium (4 pacotes + responsivo) → aprovação do dono → estender a todas as telas.
2. Mercado Pago alinhado ao Parque das Feiras (pode exigir CPF/CNPJ do pagador).
3. Telas admin **Cobrança** e **Saúde** (hoje "Em breve").
4. QA das telas novas + responsivo em 5 larguras + **2 rodadas E2E completas seguidas verdes**.
5. Órion: revisão dos pontos novos (Clientes/CSV, SQL cru, drag-and-drop).
6. Termos de uso e privacidade (texto do dono).

## Publicação (seguindo `docs/deploy-easypanel.md`)

1. Easypanel: Postgres + App do GitHub + `DATABASE_URL`/`AUTH_SECRET` + domínio + `migrate deploy`.
2. `/instalacao` → Admin → Configurações (Evolution, n8n, SMTP, Mercado Pago + URL do webhook no MP).
3. Sincronizar n8n → Ativar bot.
4. Prova ponta a ponta real: QR → "oi" → agendar/cancelar/remarcar → Pix → e-mails; capturar os payloads reais da Evolution.

## Pós-v1

Lembrete de véspera · histórico de conversas · origem do cliente (painel vs WhatsApp) · cifragem dos segredos · rate limit distribuído.

## Decisões em aberto (dono)

- Texto próprio "Confirma a remarcação?"?
- Teste grátis de 1 dia (mercado usa 7 a 14)?
- Termos de uso e política de privacidade.
