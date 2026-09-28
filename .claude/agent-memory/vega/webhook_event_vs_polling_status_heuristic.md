---
name: webhook-event-vs-polling-status-heuristic
description: Por que resolveNextConnectionStatus ("só regride para DISCONNECTED se já estava CONNECTED") vale para o polling do dashboard mas NÃO para o webhook connection.update da Evolution
metadata:
  type: project
---

Ao normalizar status de conexão do WhatsApp (Fase 3, `src/core/whatsapp/connection-event.ts`),
criei `resolveNextConnectionStatus(current, mapped)`: só deixa regredir para `DISCONNECTED`
quando o status LOCAL já era `CONNECTED` — porque uma instância que nunca conectou fica em
`close`/`closed` na Evolution o tempo todo enquanto espera o QR ser escaneado, e isso não é uma
"queda" real.

**Essa heurística vale só para CONSULTA (polling)**: `src/modules/whatsapp/service.ts`
(`getQrCode`/`refreshConnectionStatus`) chama `connectionState()` repetidamente, então um
instante intermediário (ex.: entre criar a instância e o QR aparecer) pode devolver `close` sem
significar nada.

**NÃO vale para o webhook** (`POST /connection-events`,
`src/modules/bot-api/connection-events.ts`): um evento `connection.update` da própria Evolution é
fidedigno — ela está literalmente dizendo "isto aconteceu agora". Aplicar a heurística ali fazia
o webhook IGNORAR um `close` genuíno se o status local ainda estivesse `QRCODE` por qualquer
razão (ex.: corrida entre dois eventos), além de ter quebrado os testes já verdes da Fase 4
(`bot-api-gaps.integration.test.ts`, que esperam `close` → `DISCONNECTED` incondicional). O
webhook aplica o status bruto direto, sem a heurística.

**Regra geral para o próximo endpoint parecido:** ao decidir se uma heurística de "só regride
sob certa condição" se aplica, perguntar se a fonte do dado é um EVENTO (aplicar direto) ou uma
CONSULTA/polling (aplicar a heurística). Ver também
[[connection_event_parser_must_not_require_instance_field]] (mesmo endpoint, outro bug do mesmo
dia — rodar a suíte de integração do endpoint antes de generalizar).
