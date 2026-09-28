# Workflows n8n do InnoChat

| Arquivo | Workflow | ID no n8n do dono | Estado |
|---|---|---|---|
| `innochat-bot.json` | `innochat-bot`: chatbot de agendamento (menu numerado, sem IA) | `levHnMSXf1dOR3gS` | **inativo** |
| `innochat-erros.json` | `innochat-erros`: error workflow do bot, libera a trava da sessão | `GZSwTNgvVt4LYnwW` | **inativo** |
| `innochat-cron.json` | `innochat-cron`: de hora em hora chama `POST /billing/tick` (idempotente, "Fase 7" em `docs/contratos.md`) | `dPMhT4MqGglCpFSw` | **inativo** |

Contrato: `docs/arquitetura.md` §6.6/§6.7, `docs/api-interna.openapi.json` e as seções "API interna do bot — Fase 4" e "Fase 4b" em `docs/contratos.md`.
Estes arquivos são o export (`get_workflow_details`) e servem de histórico e diff do fluxo.
Depois de toda alteração no n8n, exporte de novo para cá.

## Importar

1. No n8n: *Workflows → Import from File*. Importe **primeiro** `innochat-erros.json` e depois `innochat-bot.json`.
2. Se o ID do `innochat-erros` mudar na importação, abra *innochat-bot → Settings → Error Workflow* e selecione `innochat-erros`.
3. Preencha os placeholders e as credenciais (abaixo). Só ative os dois workflows quando o painel estiver no ar.

## Placeholders

| Onde | Campo | Valor atual | Preencher com |
|---|---|---|---|
| `innochat-bot` → nó **Config** | `painelUrl` | `https://PAINEL_A_DEFINIR/api/internal/v1` | `https://<painel>/api/internal/v1` |
| `innochat-bot` → nó **Config** | `evolutionUrl` | `https://EVOLUTION_A_DEFINIR` | URL base da Evolution, sem barra no fim |
| `innochat-bot` → nó **Config** | `n8nApiUrl` | `https://N8N_A_DEFINIR/api/v1` | `https://<n8n>/api/v1`. **Hoje nenhum nó do bot lê este campo**: ele existe para a sincronização do painel ter onde escrever |
| `innochat-erros` → nó **Config erros** | `n8nApiUrl` | `https://N8N_A_DEFINIR/api/v1` | `https://<n8n>/api/v1`. **É este que o workflow de erro usa** |
| `innochat-cron` → nó **Config cron** | `painelUrl` | `https://PAINEL_A_DEFINIR/api/internal/v1` | igual ao `painelUrl` do bot |

O fuso não é mais configurado no n8n. O claim devolve `tenant.timezone`, e `/availability/days` é chamado sem `from`, então o painel usa "hoje" no fuso do tenant.

**Contrato com a sincronização painel → n8n (não renomear):**
- Nós `Config` e `Claim` (o `innochat-erros` procura esses dois nomes no runData).
- Campos do `Config`: `painelUrl`, `evolutionUrl`, `n8nApiUrl`, `token`, `event` e `payload`.
- Nomes das três credenciais abaixo.
- No `innochat-cron`: o nó `Config cron`, o campo `painelUrl` e o nó HTTP `Chamar billing/tick`.

O campo `token` do nó **Config** **não é segredo**: é o `webhookToken` lido do path da URL (`:token`).
O validador do n8n acusa o nome como "credencial", mas é falso positivo.

## Credenciais (tipo *Header Auth*, criar à mão e selecionar nos nós)

Os nomes abaixo são **exatos**: a sincronização do painel liga as credenciais por eles.

| Nome (exato) | Header | Valor | Workflow | Nós HTTP que usam |
|---|---|---|---|---|
| `InnoChat Painel (Bearer)` | `Authorization` | `Bearer <INTERNAL_API_SECRET>` (gerado no admin da plataforma) | `innochat-bot` | `Claim`, `Registrar conexão`, `Buscar serviços`, `Buscar meus agendamentos`, `Buscar profissionais`, `Buscar dias`, `Buscar horários`, `Salvar nome`, `Reservar horário`, `Remarcar agendamento`, `Cancelar agendamento`, `Salvar sessão`, `Enviar para sandbox` (13 nós) |
| `InnoChat Painel (Bearer)` | idem | idem | `innochat-erros` | `Liberar trava` |
| `InnoChat Painel (Bearer)` | idem | idem | `innochat-cron` | `Chamar billing/tick`. Vai **sem** `X-InnoChat-Instance`, porque o tick não é escopado a uma instância |
| `Evolution API (apikey)` | `apikey` | chave da Evolution | `innochat-bot` | `Enviar pela Evolution` |
| `n8n API (X-N8N-API-KEY)` | `X-N8N-API-KEY` | API key do n8n (*Settings → n8n API*) | `innochat-erros` | `Buscar execução com falha` |

São 17 nós HTTP no total: 14 no bot, 2 no workflow de erro e 1 no cron. Todos usam *Authentication: Generic → Header Auth* (`httpHeaderAuth`).

Os workflows foram criados sem credencial nenhuma. Os nós HTTP ficam com a autenticação *Header Auth* selecionada, mas vazia, até alguém escolher a credencial.

## URL do webhook (para o painel)

O nó `Webhook` escuta `POST /webhook/innochat/evolution/:token`. No admin da plataforma, configure
`n8nWebhookBaseUrl = https://<n8n>/webhook/innochat/evolution`, e o painel acrescenta `/<webhookToken>`.
Confira a URL de produção exibida no nó depois de ativar, porque algumas versões do n8n prefixam o `webhookId` em paths dinâmicos.

## Configuração (LGPD)

- `innochat-bot`: não salva execuções bem-sucedidas; salva as com erro; não salva execuções manuais. Timeout de 120 s.
- A retenção de 7 dias das execuções com erro é **da instância**, não do workflow: `EXECUTIONS_DATA_PRUNE=true` e `EXECUTIONS_DATA_MAX_AGE=168`.
- `innochat-erros` também não salva sucesso. Ele busca a execução com falha, que contém telefone e texto, então salvar o sucesso dele vazaria esse dado.

## Mapa dos nós (`innochat-bot`)

```
Webhook → Config → Filtrar evento ─ conexão ─► Registrar conexão (POST /connection-events)
                                  └ mensagem ─► Claim (POST /messages/claim)
Claim → Roteia claim ─ ignorar ─► Ignorar (claim)
                     ├ ocupado ─► Tentar de novo? ($runIndex < 6) ─► Esperar (retryAfterMs) ─► Claim
                     │                                             └► Desistir (ocupado)
                     └ processar ─► Interpretar (Code, genérico) ─► Switch por passo
Switch por passo:
  PRONTO               ─► Montar mensagem   (mídia, 0/menu, sair, inválida, 3 inválidas, sessão nova/expirada, "Ver mais")
  MAIN_MENU            ─► Opção do menu ─ agendar ► Buscar serviços ► Resultado serviços
                                        ├ meus    ► Buscar meus agendamentos ► Resultado meus agendamentos
                                        └ atendente ► Pedir atendente (handoff)
  SELECT_SERVICE       ─► Buscar profissionais ► Resultado profissionais ► Pular profissional? ─ sim ► Preparar dias
  SELECT_PROFESSIONAL  ─► Profissional escolhido ► Preparar dias
  SELECT_DAY           ─► Dia escolhido ► Ver mais datas? ─ sim ► Preparar dias / não ► Preparar horários
  SELECT_TIME          ─► Horário escolhido ► Mais horários? ─ sim ► Preparar horários / não ► (CONFIRM ou ASK_NAME)
  ASK_NAME             ─► Salvar nome (PATCH /contacts/{id}) ► Resultado nome
  CONFIRM              ─► Confirmação ► Rota da confirmação ─ reservar ► Reservar horário (POST /appointments) ► Resultado reserva
                                                          ├ outro horário ► Preparar horários
                                                          ├ outro dia ► Preparar dias
                                                          └ remarcar (context.mode = RESCHEDULE) ► Remarcar agendamento
                                                              (POST /appointments/{id}/reschedule) ► Resultado remarcação
  MY_APPOINTMENTS      ─► Agendamento escolhido (guarda serviceId/professionalId/servico/data/hora do item em context.appointment)
  APPOINTMENT_ACTION   ─► Ação escolhida ► Remarcar? ─ 2 remarcar ► Preparar dias (mesmo serviço e profissional, mode = RESCHEDULE)
                                                    └ 1 cancelar ► Montar mensagem (CONFIRM_CANCEL com os campos estruturados)
  CONFIRM_CANCEL       ─► Confirmou cancelamento? ─ sim ► Cancelar agendamento ► Resultado cancelamento / não ► Manter agendamento
Preparar dias → Buscar dias (GET /availability/days) → Resultado dias
Preparar horários → Buscar horários (GET /availability/slots) → Resultado horários
Todos os "Resultado …" → Montar mensagem (único nó que monta texto)
Montar mensagem → Salvar sessão (PUT /sessions/{id}) → Resultado da gravação
   ─ 200 ► Sandbox? ─ sim ► Enviar para sandbox (POST /sandbox/outbox)
                    └ não ► Preparar envio ► Separar mensagens ► Enviar pela Evolution (sendText, batch 1)
   ─ 409 ► Descartar (LOCK_LOST)   (não envia)
   ─ outro ► Falha ao salvar sessão (erro → innochat-erros libera a trava)
```

Contrato entre os ramos e o `Montar mensagem`: cada ramo devolve
`{ result: { nextState, contextPatch, resetContext, textKey, vars, options, handoff, prefixKey, repeatPrompt, invalidCount, end } }`.
A numeração e a lógica de paginação ficam no `Montar mensagem`. O texto vem de `texts[textKey]` enviado pelo claim.

Os rótulos estruturais vêm de `texts`. Se a chave faltar ou estiver vazia, vale o texto padrão entre parênteses:
- `LABEL_CONFIRM` ("Confirmar") e `LABEL_OTHER_TIME` ("Escolher outro horário")
- `LABEL_CANCEL_YES` ("Sim, cancelar") e `LABEL_CANCEL_NO` ("Não, manter")
- `LABEL_MORE_DAYS` ("Ver mais datas"), `LABEL_MORE_TIMES` ("Mais horários") e `LABEL_MORE` ("Ver mais")
- `LABEL_BACK_TO_MENU` ("0. Menu principal")

As opções do menu principal e de "Cancelar/Remarcar" já estão numeradas nos textos `MAIN_MENU` e `APPOINTMENT_ACTIONS`.

**Remarcar:**
- Reaproveita `SELECT_DAY → SELECT_TIME → CONFIRM` com `context.mode = RESCHEDULE`. Não pergunta o nome e não troca serviço nem profissional.
- A confirmação usa o mesmo texto `CONFIRM_SUMMARY` do agendamento novo.
- O 200 volta para o menu com o texto `RESCHEDULED`. Como o 200 só traz `{appointmentId,startsAt}`, `{data}` e `{hora}` saem dos rótulos escolhidos.
- 409 `SLOT_TAKEN` oferece as alternativas e mantém o modo.
- Qualquer outro 409 (`TOO_LATE`) volta para o menu com o texto `TOO_LATE`.
- 422/403 vira `NO_AVAILABILITY` e 404 vira `NO_APPOINTMENTS`.

## `innochat-cron`

```
De hora em hora (Schedule, minuto 5) → Config cron → Chamar billing/tick (POST, timeout 60 s, Never error + resposta completa)
  → Resultado do tick ─ 2xx ► Tick ok
                      ├ 5xx ► Tentar de novo? (5xx) ($runIndex < 2) ─ sim ► Esperar (5xx) 5 s ► Chamar billing/tick
                      │                                             └ não ► Falha no tick
                      └ outro (4xx) ► Falha no tick (erro)
```

- Timeout e falha de rede são re-tentados pelo *Retry on fail* do próprio nó (3×). Um 5xx tem mais 2 tentativas pelo laço, e um 4xx falha direto. Re-tentar é seguro porque o tick é idempotente.
- Settings: não salva sucesso, salva erro, timeout de 300 s. O `errorWorkflow` aponta para o `innochat-erros`.
  - Isso não quebra a extração de trava: sem nó `Claim` na execução, `Extrair trava` devolve `[]` e o workflow de erro termina sem chamar `release`.
  - Efeito colateral: a cada falha do cron, o workflow de erro faz uma chamada à API do n8n à toa.

## Política de retry

- GETs do painel e `Claim`: *Retry on fail* (3×, 1 s), cobrindo 5xx e timeout.
- Escritas que podem responder 409 (`Salvar sessão`, `Reservar horário`, `Remarcar agendamento`, `Cancelar agendamento`, `Salvar nome`): *Never error* + resposta completa, com retry só em timeout ou falha de rede. **409 nunca é re-tentado.** Um 5xx nessas escritas não é re-tentado dentro da execução: o ramo lança erro e o `innochat-erros` libera a trava.
- Envio pela Evolution e sandbox: sem retry, porque o envio não é idempotente.
