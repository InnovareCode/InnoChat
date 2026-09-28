# Contratos — Fase 1 (fundação)

Esqueleto das Server Actions / rotas previstas para a Fase 1. Detalhamento
completo (Server Actions do domínio, API interna do bot) fica para as Fases
2–4, conforme docs/arquitetura.md §13. Aqui só o que a fundação já expõe ou
precisa expor para Lyra integrar login/onboarding básico.

Convenção: Server Actions devolvem `Result<T>` —
`{ ok: true, data: T } | { ok: false, error: { code, message } }` — nunca
lançam para erro esperado (validação, regra de negócio). Erros inesperados
(bug, banco fora do ar) propagam e viram a tela de erro do Next.

---

## Autenticação (`src/lib/auth.ts`, Auth.js v5)

- `POST /api/auth/callback/credentials` (gerado pelo Auth.js) — login por
  e-mail/senha. Consumido pelo formulário de login via `signIn("credentials", …)`
  do lado do cliente ou por uma Server Action fina que chama `signIn`.
- `GET/POST /api/auth/*` — demais rotas padrão do Auth.js (sessão, CSRF).
- Sessão: JWT, `session.user.id` disponível em Server Components via `auth()`.

**Resolvido** (schema do Cronos já disponível ao final desta rodada):
`verifyCredentials` (`src/modules/auth/service.ts`) usa `getPrisma().user`
direto (model global, não tenant-scoped — arquitetura.md §5) e compila contra
o schema real. **Sem `PrismaAdapter`**: `prisma/schema.prisma` não tem
`Account`/`Session`/`VerificationToken` (os models que o adapter padrão do
Auth.js exige) — não há provider OAuth na v1 e a sessão é JWT, então o
adapter não fazia falta. Se um provider OAuth entrar pós-v1, revisitar
`src/lib/auth.ts` e adicionar os models que faltarem no schema.

O model `User` não tem campo de nome de exibição — `AuthorizedUser.name`
fica `null` até essa necessidade aparecer (provavelmente por
`Membership`/`Tenant`, não por `User`).

## Guardas de autorização (`src/lib/auth/guards.ts`)

Toda Server Action chama uma destas ANTES de tocar o banco — nunca confiam em nada vindo do
client sobre quem é o usuário ou a que tenant ele pertence:

- `requireSessionUser(): Promise<{ id: string }>` — exige sessão Auth.js válida. Lança
  `DomainError("UNAUTHENTICATED", …)` senão.
- `requirePlatformAdmin(): Promise<{ id: string }>` — relê `isPlatformAdmin` do banco a partir
  do id da sessão (nunca confia em um campo do client). Lança `DomainError("FORBIDDEN", …)`.
- `requireTenantMember(slug, roles?): Promise<{ tenant, membership, user }>` — resolve o tenant
  **pelo slug da URL**, nunca por um id vindo do client, e confirma `Membership` do usuário da
  sessão nele. Empresa inexistente OU sem membership → o mesmo `DomainError("NOT_FOUND", …)`
  (nunca `FORBIDDEN`, para não confirmar a existência da empresa para quem não é membro — mesma
  lógica do §6.1 da API interna). Se `roles` for passado (ex.: `["OWNER"]`) e o papel do usuário
  não estiver na lista, `DomainError("FORBIDDEN", …)`.

`DomainError` (`src/lib/errors.ts`) representa toda condição ESPERADA (validação, regra de
negócio, permissão). `runAction()` (`src/lib/result.ts`) executa o corpo de uma Server Action e
converte `DomainError`/`ZodError` em `Result` de falha — qualquer outro erro (bug, banco fora do
ar) propaga e vira a tela de erro do Next. Toda Server Action abaixo segue este formato:
`{ ok: true, data: T } | { ok: false, error: { code, message, details? } }`.

## Admin da plataforma (`src/modules/platform/actions.ts`) — Fase 1

Guardadas por `requirePlatformAdmin()`. `PlatformSettings` é singleton (`id = 1`), sempre
`upsert`. Segredos NUNCA voltam em texto puro — só mascarados (`"••••1234"`, últimos 4
caracteres) ou como booleano `configured`. Ao salvar, campo de texto/segredo vazio ou ausente =
"manter o valor atual" (nunca apaga um segredo sem querer).

- `getPlatformSettingsAction(): Result<PlatformSettingsView>`
  ```ts
  type PlatformSettingsView = {
    evolutionApiUrl: string | null;
    evolutionApiKeyMasked: string | null;
    n8nWebhookBaseUrl: string | null;
    internalApiSecretConfigured: boolean; // nunca o hash, nunca o segredo
    mercadoPagoAccessTokenMasked: string | null;
    mercadoPagoWebhookSecretMasked: string | null;
    smtpHost: string | null; smtpPort: number | null; smtpSecure: boolean | null;
    smtpUser: string | null; smtpPasswordMasked: string | null; smtpFrom: string | null;
    termsVersion: string | null;
    updatedAt: string | null; updatedByUserId: string | null;
  };
  ```
- `updatePlatformSettingsAction(input): Result<PlatformSettingsView>` — `input` aceita
  `evolutionApiUrl?`, `evolutionApiKey?`, `n8nWebhookBaseUrl?`, `mercadoPagoAccessToken?`,
  `mercadoPagoWebhookSecret?`, `smtpHost?`, `smtpPort?`, `smtpSecure?`, `smtpUser?`,
  `smtpPassword?`, `smtpFrom?`, `termsVersion?` — todos opcionais, `""` = manter.
  Erros: `INVALID_PAYLOAD` (zod), `FORBIDDEN`.
- `regenerateInternalApiSecretAction(): Result<{ secret: string }>` — gera e devolve o segredo
  da API interna do n8n **em texto puro, uma única vez**; persiste só o hash SHA-256
  (`internalApiSecretHash`). A tela precisa mostrar isso ao dono nesta resposta e nunca mais
  poder buscá-lo de volta (`getPlatformSettingsAction` só devolve `internalApiSecretConfigured`).

## Tema do tenant (`src/modules/tenant/actions.ts`) — Fase 1/2

- `updateTenantThemeAction(tenantSlug, input): Result<{ theme: string }>` — `input: { theme:
  "INDIGO_CLINICO" | "AMBAR_ESTUDIO" | "VERDE_SLATE" }`. Restrito a `OWNER`
  (`requireTenantMember(slug, ["OWNER"])`). Erros: `NOT_FOUND` (empresa/membership), `FORBIDDEN`
  (não é OWNER), `INVALID_PAYLOAD`.

## Catálogo e agenda (Fase 2)

Todas guardadas por `requireTenantMember(tenantSlug)` (qualquer papel, sem restrição adicional
nesta fase). **TODO explícito**: limite de profissionais/números por plano (`maxProfessionals`,
`maxWhatsappNumbers` do `Plan`, mais os `*Override` do `Tenant`) ainda NÃO é verificado em
`createProfessionalAction` — cobrança/planos é Fase 7 (docs/arquitetura.md §13); quem implementar
a Fase 7 precisa adicionar essa checagem antes de liberar o cadastro público.

### `src/modules/agenda/catalog-actions.ts`

- `listServicesAction(tenantSlug): Result<Service[]>`
- `createServiceAction(tenantSlug, input): Result<Service>` — `input: { name, durationMin,
  bufferAfterMin?, priceCents?, active?, sortOrder? }`.
- `updateServiceAction(tenantSlug, serviceId, input): Result<Service>` — `input` parcial do
  schema acima. Erro: `NOT_FOUND`.
- `deleteServiceAction(tenantSlug, serviceId): Result<{ id }>` — bloqueia com
  `HAS_APPOINTMENTS` se o serviço tem QUALQUER agendamento (o schema faz `onDelete: Cascade`
  para `Appointment` — perderia histórico); a tela deve oferecer "desativar" (`active: false`,
  via `updateServiceAction`) como alternativa.
- `listProfessionalsAction(tenantSlug): Result<Professional[]>` — inclui `professionalServices`
  (`serviceId[]`) e `workingHours`.
- `createProfessionalAction(tenantSlug, input): Result<Professional>` — `input: { name, active?,
  sortOrder? }`.
- `updateProfessionalAction(tenantSlug, professionalId, input): Result<Professional>`.
- `deleteProfessionalAction(tenantSlug, professionalId): Result<{ id }>` — mesma cautela de
  `deleteServiceAction`: `HAS_APPOINTMENTS` se tiver qualquer agendamento.
- `setProfessionalServicesAction(tenantSlug, professionalId, input): Result<Professional>` —
  `input: { serviceIds: string[] }`; substitui TODOS os serviços que o profissional realiza.
  Erro: `INVALID_SERVICE_IDS` se algum id não for desta empresa.
- `setProfessionalWorkingHoursAction(tenantSlug, professionalId, input): Result<WorkingHour[]>`
  — `input: { hours: { weekday: 0-6, startTime: "HH:mm", endTime: "HH:mm" }[] }`; substitui TODO
  o expediente do profissional (replace-all). Erro: `INVALID_WORKING_HOUR`.
- `listScheduleExceptionsAction(tenantSlug, range?): Result<ScheduleException[]>` — `range?: {
  from: string; to: string }` (ISO).
- `createScheduleExceptionAction(tenantSlug, input): Result<ScheduleException>` — `input: {
  professionalId: string | null, type: "BLOCK" | "HOLIDAY", startsAt, endsAt, reason? }`.
  `professionalId: null` = bloqueio da empresa inteira. Erros: `INVALID_RANGE`, `NOT_FOUND`
  (profissional).
- `deleteScheduleExceptionAction(tenantSlug, exceptionId): Result<{ id }>`.

### `src/modules/agenda/appointment-actions.ts`

- `listAppointmentsAction(tenantSlug, input): Result<Appointment[]>` — `input: { from, to,
  professionalId?, limit? }` (datas ISO). Erros: `INVALID_RANGE` (to ≤ from),
  `RANGE_TOO_LARGE` (> 95 dias). `limit` máx. 500, padrão 100 — sempre paginado, nunca "todos os
  registros".
- `createAppointmentAction(tenantSlug, input): Result<{ appointment, alreadyExisted: boolean }>`
  — `input: { contactId?, contactName?, contactPhoneE164?, serviceId, professionalId: string |
  null, startsAt, idempotencyKey? }`. `professionalId: null` = "qualquer profissional" apto e
  livre (o painel escolhe). Sem `contactId`, cria/reaproveita um contato "de painel"
  (`contactName` obrigatório nesse caso) — CRUD completo de clientes é de outro módulo (Fase 8).
  **Idempotente**: mesma `idempotencyKey`, OU mesmo contato+serviço+início já `SCHEDULED`, →
  `200`-equivalente com `alreadyExisted: true` e o agendamento existente (nunca duplica).
  Erros: `NOT_FOUND` (serviço/profissional/contato/nenhum profissional apto),
  `RULE_VIOLATION` com `details.rule ∈ OUTSIDE_HOURS | LEAD_TIME | HORIZON | INACTIVE`,
  `SLOT_TAKEN` com `details.alternatives` (até 6 horários livres do mesmo profissional/dia) —
  coberto tanto por uma verificação prévia quanto pela constraint `EXCLUDE` do banco como última
  linha de defesa contra corrida (provado em `tests/integration/agenda.integration.test.ts` com
  20 requisições paralelas: exatamente 1 sucesso, 19 `SLOT_TAKEN`).
- `cancelAppointmentAction(tenantSlug, appointmentId, input?): Result<Appointment>` — `input?: {
  note? }`. Idempotente (cancelar um já cancelado devolve `200` sem erro). Erros: `NOT_FOUND`,
  `TOO_LATE` (dentro de `Tenant.cancelMinLeadMin`).
- `rescheduleAppointmentAction(tenantSlug, appointmentId, input): Result<Appointment>` —
  `input: { startsAt }`. Erros: `NOT_FOUND`, `INVALID_STATE` (não está `SCHEDULED`), `TOO_LATE`,
  `RULE_VIOLATION`, `SLOT_TAKEN`.

### `src/core/agenda` (funções puras, sem I/O — docs/arquitetura.md §5, §10)

Usadas pelos módulos acima e reaproveitáveis pela API interna do bot (Fase 4):

- `computeDayWindows(dateISO, timezone, workingHours, closedRanges): TimeWindow[]`
- `computeAvailableSlots({ dateISO, timezone, workingHours, closedRanges, busy,
  serviceDurationMin, slotGranularityMin, minLeadTimeMin, now, professionalEligible? }):
  Date[]` — `professionalEligible: false` (profissional não faz o serviço) sempre `[]`.
- `computeAvailableDays({ …, maxHorizonDays, fromDateISO, limit }): { days: string[]; hasMore:
  boolean }`
- `checkBookingWindow({ start, end, timezone, workingHours, closedRanges, minLeadTimeMin,
  maxHorizonDays, now }): "OUTSIDE_HOURS" | "LEAD_TIME" | "HORIZON" | null`
- `isRangeFreeOfBusy(start, end, busy): boolean`

Testes em `src/core/agenda/__tests__/availability.test.ts`: virada de dia (fuso cruza a data
UTC), horário de verão (troca de offset em `America/New_York`), bloqueio parcial no meio do
expediente, serviço que não cabe no fim do expediente, profissional que não faz o serviço.

### `src/modules/agenda/availability-actions.ts` — disponibilidade para o widget de agendamento manual

Substitui, por Server Action, a rota `GET /api/agenda/slots?…` cogitada em
docs/arquitetura.md §6.10 (Server Actions já servem Client Components — não precisa virar rota
HTTP separada). `professionalId: null` = "qualquer profissional" apto (união dos livres).

- `listAvailableSlotsAction(tenantSlug, { serviceId, professionalId, date }): Result<{ slots:
  string[] }>` — `date: "YYYY-MM-DD"`, `slots` são instantes ISO UTC, já ordenados.
- `listAvailableDaysAction(tenantSlug, { serviceId, professionalId, from, limit? }): Result<{
  days: string[]; hasMore: boolean }>` — `from`/`days` em `"YYYY-MM-DD"`, `limit` padrão 7,
  máx. 30 (sempre paginado).

## API interna do bot (n8n → painel)

Fora do escopo da Fase 1 (arquitetura.md §13, Fase 4). Ver docs/arquitetura.md
§6.1–6.9 para o contrato completo já fechado — a Vega implementa a partir da
Fase 4, com OpenAPI gerado do zod em `docs/api-interna.openapi.json`.

## Rotas HTTP do navegador previstas (Fase 2+)

Reservadas em `src/app/api/`, ainda não implementadas nesta fase:

- `GET /api/whatsapp/instances/{id}/state` (Fase 3)
- `GET /api/agenda/slots?…` (Fase 2)
- `GET /api/billing/invoices/{id}/status` (Fase 7)
- `POST /api/webhooks/mercadopago` (Fase 7)

---

## O que a Íris deve testar nesta fase

- `src/lib/db/tenant-scope.ts` (`scopeArgsToTenant`, `isTenantScopedModel`) —
  testes unitários já em `src/lib/db/__tests__/tenant-scope.test.ts`, sem
  depender de Postgres.
- `src/env.ts` — validação falha com mensagem clara quando falta uma env var
  obrigatória (não testado automaticamente ainda; sugestão de teste para a
  Íris quando o schema existir e o build completo puder rodar).
- Depois que o schema existir: fluxo de login (e-mail/senha correto, senha
  errada, e-mail inexistente — todos devolvendo a mesma mensagem genérica).
- `src/core/agenda/__tests__/availability.test.ts` — já cobre os 5 cenários pedidos (virada de
  dia, DST, bloqueio parcial, serviço que não cabe, profissional inapto). Vale a Íris somar
  casos de borda extras (ex.: expediente com múltiplas faixas no mesmo dia, bloqueio que cobre o
  expediente inteiro).
- `tests/integration/agenda.integration.test.ts` (`npm run test:integration`, requer
  `TEST_DATABASE_URL` com migrations aplicadas) — concorrência real (20 paralelas → 1 sucesso +
  19 `SLOT_TAKEN`), idempotência, isolamento entre tenants por id (cancelar/remarcar/editar
  catálogo/listar). A Íris deve rodar o fluxo completo do painel (criar serviço → profissional →
  expediente → agendamento manual → cancelar/remarcar) via Playwright quando a Lyra tiver as
  telas, e testar especificamente: dois usuários de empresas diferentes tentando adivinhar o id
  um do outro na URL.
- Admin da plataforma: salvar segredo, reabrir a tela e confirmar que ele volta mascarado (nunca
  em texto puro); campo vazio no formulário não apaga o valor salvo; `internalApiSecretConfigured`
  vira `true` só depois de gerar o segredo, e o valor em texto puro nunca aparece de novo.

## O que o Órion deve revisar

- `getPrisma()` é FUNÇÃO, nunca Proxy (comentário em `src/lib/db/prisma.ts`
  explica a lição do InnoAtendente).
- `forTenant()` sobrescreve `tenantId` recebido do chamador em vez de
  confiar nele — checar que nenhum código futuro tenta contornar isso
  passando `tenantId` para dentro de um `where`/`data` já dentro de
  `forTenant()` esperando que "o mais específico ganha" (não ganha: o
  `scopeArgsToTenant` sempre sobrescreve por último).
- Regra de ESLint `no-restricted-imports` para `@prisma/client` fora de
  `src/lib/db/` — confirmar que cobre `src/core/**` com a mensagem certa
  (domínio puro, sem Prisma).
- `verifyCredentials` não lança para credencial inválida (vira `null`, não
  500) e usa mensagem genérica (sem enumeration de e-mail).
- `src/lib/auth/guards.ts`: `requireTenantMember` resolve o tenant SEMPRE por `slug` (nunca
  aceita um `tenantId` de parâmetro), e devolve `NOT_FOUND` tanto para empresa inexistente
  quanto para "sem membership" — checar que nenhuma Server Action nova aceite um `tenantId`
  direto do client como atalho para pular essa resolução.
  `requirePlatformAdmin`/`requireTenantMember` sempre releem do banco (nunca confiam em campo
  de sessão para autorização).
- `src/modules/platform/service.ts`: segredos mascarados (`maskSecret`, só os últimos 4
  caracteres); `internalApiSecretHash` nunca sai da função `regenerateInternalApiSecret`
  (verificar que nenhum `select`/log em volta dela devolve o hash ou o segredo); comparação do
  segredo (`verifyInternalApiSecret`, usado pela Fase 4) é `crypto.timingSafeEqual`, não `===`.
- `src/modules/agenda/appointments.ts`: `isExclusionViolation` detecta a constraint `EXCLUDE`
  por assinatura (`PrismaClientUnknownRequestError` + SQLSTATE `23P01` na mensagem) porque o
  Prisma não dá um `error.code` próprio para isso — confirmado contra o Postgres real
  (documentado no comentário da função); se uma versão futura do Prisma passar a reconhecer
  `23P01` com um `code` dedicado, simplificar a checagem.
- `deleteService`/`deleteProfessional` bloqueiam DELETE se houver qualquer `Appointment`
  vinculado (`HAS_APPOINTMENTS`) — o schema tem `onDelete: Cascade` em `Appointment`, então um
  DELETE sem essa checagem apagaria histórico de agendamento silenciosamente.
- `src/modules/agenda/catalog.ts` (`setProfessionalServices`, `setProfessionalWorkingHours`):
  `ProfessionalService`/`WorkingHour` não têm `tenantId` próprio — checar que todo acesso carrega
  o `Professional` pai via `forTenant()` ANTES de tocar o filho (mesma lição documentada em
  `.claude/agent-memory/vega/for_tenant_scope_limits.md`).
