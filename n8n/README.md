# Workflows n8n do InnoChat

| Arquivo | Workflow | ID no n8n do dono | Estado |
|---|---|---|---|
| `innochat-bot.json` | `innochat-bot`: chatbot de agendamento (menu numerado, sem IA) | `levHnMSXf1dOR3gS` | **inativo** |
| `innochat-erros.json` | `innochat-erros`: error workflow do bot, libera a trava da sessão | `GZSwTNgvVt4LYnwW` | **inativo** |

Contrato: `docs/arquitetura.md` §6.6/§6.7, `docs/api-interna.openapi.json` e "API interna do bot — Fase 4" em `docs/contratos.md`.
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
| `innochat-bot` → nó **Config** | `timezone` | `America/Sao_Paulo` | Fuso usado só para o `from` de `/availability/days` |
| `innochat-erros` → nó **Config erros** | `n8nApiUrl` | `https://N8N_A_DEFINIR/api/v1` | `https://<n8n>/api/v1` (API pública do próprio n8n) |

O campo `token` do nó **Config** **não é segredo**: é o `webhookToken` lido do path da URL (`:token`).
O validador do n8n acusa o nome como "credencial", mas é falso positivo.

## Credenciais (tipo *Header Auth*, criar à mão e selecionar nos nós)

| Nome sugerido | Header | Valor | Nós que usam |
|---|---|---|---|
| `InnoChat Painel (Bearer)` | `Authorization` | `Bearer <INTERNAL_API_SECRET>` (gerado no admin da plataforma) | Todos os HTTP do painel nos dois workflows |
| `Evolution API (apikey)` | `apikey` | chave da Evolution | `Enviar pela Evolution` |
| `n8n API (X-N8N-API-KEY)` | `X-N8N-API-KEY` | API key do n8n (*Settings → n8n API*) | `innochat-erros` → `Buscar execução com falha` |

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
                                                          └ outro dia ► Preparar dias
  MY_APPOINTMENTS      ─► Agendamento escolhido
  APPOINTMENT_ACTION   ─► Ação escolhida (1 cancelar → CONFIRM_CANCEL · 2 remarcar → atendente, ver pendências)
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
As opções estruturais (menu principal, confirmar e cancelar, ações do agendamento), a numeração, o rodapé `0. Menu principal` e a paginação (`9. Ver mais`) ficam no `Montar mensagem`.
O texto vem de `texts[textKey]` enviado pelo claim.

## Política de retry

- GETs do painel e `Claim`: *Retry on fail* (3×, 1 s), cobrindo 5xx e timeout.
- Escritas que podem responder 409 (`Salvar sessão`, `Reservar horário`, `Cancelar agendamento`, `Salvar nome`): *Never error* + resposta completa, com retry só em timeout ou falha de rede. **409 nunca é re-tentado.** Um 5xx nessas escritas não é re-tentado dentro da execução: o ramo lança erro e o `innochat-erros` libera a trava.
- Envio pela Evolution e sandbox: sem retry, porque o envio não é idempotente.
