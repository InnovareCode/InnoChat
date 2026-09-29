# InnoChat — Plano de implementação até o lançamento

Versão 2026-09-28. Mantido pelo Atlas. Cada etapa só começa quando a anterior cumpre o **critério de saída**.
Dentro de uma etapa, os itens marcados com ∥ rodam em paralelo.

## Etapa A — Fechar o núcleo (em andamento)

| # | Entrega | Quem | Critério de saída |
|---|---|---|---|
| A1 ∥ | Mercado Pago alinhado ao adaptador em produção do Parque das Feiras (Pix, dados do pagador, webhook, erros) + **teste grátis de 3 dias** | Vega | Tabela "PF vs InnoChat vs decisão" no `docs/contratos.md`; testes verdes |
| A2 ∥ | Termos de Uso e Política de Privacidade (LGPD), com aceite versionado | Atlas (redação) | Páginas `/termos` e `/privacidade` publicadas; marcadores (CNPJ, endereço, e-mails) listados para o dono |
| A3 | Se A1 exigir CPF/CNPJ do pagador: campo no cadastro e na Assinatura | Lyra | Cadastro valida o documento; E2E do cadastro verde |

## Etapa B — Visual premium em todo o produto

| # | Entrega | Quem | Critério de saída |
|---|---|---|---|
| B0 | **Aprovação do protótipo** (Início, Agenda, menu, Ctrl+K, arrastar para remarcar) | **Dono** | "Aprovado" ou lista de ajustes |
| B1 ∥ | Onda 1: Agendamentos, Clientes, Serviços, Profissionais, WhatsApp | Lyra | Prints nos 3 temas; 360–1440 sem rolagem lateral |
| B2 ∥ | Onda 2: Mensagens do bot, Configurações, Assinatura, onboarding, telas públicas (login, cadastro, instalação, termos) | Lyra | Idem |
| B3 ∥ | Admin: **Cobrança** (faturas de todas as empresas, inadimplência, reenvio de Pix) e **Saúde** (Evolution, n8n, SMTP, MP, último `billing/tick`, fila de erros) no visual premium | Vega (dados) → Lyra (tela) | Telas sem "Em breve" |
| B4 | Arrastar para remarcar também na visão Semana (opcional; entra se couber) | Lyra | Mesmo comportamento da visão Dia |

## Etapa C — Qualidade antes de publicar

| # | Entrega | Quem | Critério de saída |
|---|---|---|---|
| C1 | E2E atualizado: telas premium, Clientes, arrastar para remarcar, admin Cobrança e Saúde, responsivo em 5 larguras | Íris | **2 rodadas completas seguidas verdes** (servidor reiniciado) |
| C2 ∥ | Revisão de segurança incremental (Clientes/CSV, SQL cru, MP alinhado, telas admin novas) | Órion | Nenhuma alta aberta |
| C3 ∥ | Documentação: README, manual curto do cliente (primeiros passos), runbook de operação | Alexandria | Conferido contra o código |

## Etapa D — Publicação (dono + Atlas, seguindo `docs/deploy-easypanel.md`)

| # | Passo | Quem |
|---|---|---|
| D1 | Easypanel: Postgres, App do GitHub (`main`), `DATABASE_URL` + `AUTH_SECRET`, domínio + HTTPS | Dono (Atlas acompanha) |
| D2 | `npx prisma migrate deploy` pelo Console; conferir que os 3 planos existem com os preços | Dono + Atlas |
| D3 | Código de instalação no log → `/instalacao` → admin criado | Dono |
| D4 | Admin → Configurações: Evolution, n8n (URL + chave de API), SMTP, Mercado Pago; **Testar conexão** em cada um; URL do webhook no painel do MP | Dono |
| D5 | **Sincronizar n8n** → conferir credenciais e workflows no n8n → **Ativar bot** (liga o cron junto) | Dono + Atlas |
| D6 | **Prova ponta a ponta real** com uma empresa de teste: cadastro, confirmação de e-mail, QR, "oi", agendar, cancelar, remarcar, pausa humana, Pix real, confirmação do pagamento, e-mails | Atlas + Íris + dono |
| D7 | Capturar os payloads reais da Evolution e comparar com `fixtures/evolution/`; ajustar a normalização se divergir | Vega |
| D8 | Acompanhar 48 h: `/api/health`, execuções com erro no n8n, `billing/tick` e `maintenance/tick` | Atlas / Vulcano |

## Etapa E — Lançamento comercial

- Abrir o cadastro público para empresas reais (só depois de D6 e D8 verdes).
- Primeiros clientes com acompanhamento próximo; ajustes finos de textos do bot.

## Pós-v1 (backlog combinado)

Lembrete de véspera (maior argumento de venda: menos faltas) · histórico de conversas · origem do cliente (painel vs WhatsApp) ·
cifragem dos segredos em repouso · rate limit distribuído · arrastar entre profissionais (contrato novo de remarcação).

## Pendências do dono

- Aprovar o protótipo premium (B0).
- Preencher nos termos: CNPJ, endereço, e-mail de contato, e-mail do encarregado (DPO) e comarca.
- Texto próprio "Confirma a remarcação?" no bot (opcional).
