---
name: fase2_revisao_2026-09-29
description: Revisão da fase 2 (lembrete WhatsApp, histórico de conversas, notificações admin, nome do usuário) — sem CRÍTICO; padrões recorrentes a checar em código novo
metadata:
  type: project
---

Veredito 2026-09-29: sem CRÍTICO. Isolamento (forTenant em ChatMessage, requireTenantMember, requirePlatformAdmin, KEY_PATTERN nos ids, renderTemplate single-pass, React sem dangerouslySetInnerHTML) está sólido.

Padrões recorrentes a checar em código novo:
- `logger.*({ errorMessage: error.message })` em caminhos que manipulam TEXTO de mensagem (log.ts, reminders/tick.ts): mensagem de erro do Prisma pode ecoar args (body). Logar só name/code.
- Read-modify-write de `ChatSession.recentOutbound` (reminders/tick.ts registerOutboundEcho vs bot-api/session.ts updateSession): sem lock/versão; perda de hash => eco vira HUMAN_TOOK_OVER (pausa o bot do cliente).
- Feature nova de envio proativo com `@default(true)` em coluna de tenant: liga para TODAS as empresas existentes no primeiro tick pós-deploy.
- Contadores de tentativa em memória (failedAttempts) resetam a cada restart/instância.
- Purga por `createdAt` em tabela sem índice iniciado em createdAt (chat_messages).

Ver [[tenant_isolation_pattern]].
