---
name: tenant_isolation_pattern
description: Como o InnoChat garante isolamento multiempresa (forTenant, guards, API interna) — o padrão de referência para auditar qualquer Server Action ou rota nova
metadata:
  type: project
---

O InnoChat (`C:\Projetos\Web\InnoChat`) tem um padrão de isolamento multi-tenant bem desenhado,
validado na auditoria de 2026-09-28 (`docs/seguranca/revisao-2026-09-28.md`):

- `src/lib/db/tenant-scope.ts` + `tenant-client.ts#forTenant(tenantId)`: sobrescreve `tenantId` em
  toda operação Prisma dos models com coluna própria (lista fechada em `TENANT_SCOPED_MODELS`), e
  **lança** para qualquer operação não coberta (fail-closed, nunca passa sem escopo).
- Models filhos SEM `tenantId` próprio (`ProfessionalService`, `WorkingHour`, `AppointmentEvent`,
  `ChatSession`, `InboundEvent`, `Invoice`) — o isolamento é por relação: sempre carregar o pai
  (`Professional`, `Appointment`, `WhatsappInstance`, `Subscription`) via `forTenant()` ou por
  `whatsappInstanceId` resolvido do token ANTES de tocar o filho.
- Toda Server Action resolve o tenant por `slug` da URL via `requireTenantMember` — nunca aceita
  um `tenantId` do client. Empresa inexistente e "sem membership" devolvem o MESMO `NOT_FOUND`
  (nunca `FORBIDDEN`), pra não confirmar existência a quem não é membro.
- API interna do bot (`resolveInternalRequest`): tenant sempre vem do `webhookToken` (header
  `X-InnoChat-Instance`), nunca do corpo. Todo id recebido (`contactId`, `appointmentId`,
  `sessionId`) é revalidado contra esse tenant e devolve `404` (nunca `403`) se não pertencer.
- Páginas Server Component em `src/app/(app)/[tenantSlug]/**` herdam o gate de acesso do
  `layout.tsx` (sessão + `Membership`, 404 se ausente) — não repetem a checagem individualmente,
  o que é válido porque o App Router sempre renderiza o layout antes da página.

**Ao auditar qualquer Server Action ou rota NOVA neste projeto**, o roteiro é: (1) o tenant vem de
onde — slug/token, nunca client? (2) se toca um model filho sem `tenantId`, carregou o pai
escopado antes? (3) ids recebidos do client (contactId, appointmentId etc.) são revalidados contra
o tenant resolvido, com 404 e não 403 na falha?

Ver também [[login_sem_rate_limit]] e [[secrets_masking_pattern]].
