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
    publicBaseUrl: string | null; // só leitura — ver "Configuração pela plataforma" abaixo
    evolutionApiUrl: string | null;
    evolutionApiKeyMasked: string | null;
    n8nWebhookBaseUrl: string | null;
    n8nBaseUrl: string | null;
    n8nApiKeyMasked: string | null;
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
  `evolutionApiUrl?`, `evolutionApiKey?`, `n8nWebhookBaseUrl?`, `n8nBaseUrl?`, `n8nApiKey?`,
  `mercadoPagoAccessToken?`, `mercadoPagoWebhookSecret?`, `smtpHost?`, `smtpPort?`,
  `smtpSecure?`, `smtpUser?`, `smtpPassword?`, `smtpFrom?`, `termsVersion?` — todos opcionais,
  `""` = manter. Na primeira chamada, grava `publicBaseUrl` sozinho a partir da requisição (ver
  "Configuração pela plataforma"). Erros: `INVALID_PAYLOAD` (zod), `FORBIDDEN`.
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

## API interna do bot (n8n → painel) — Fase 4

Implementada. Contrato completo em docs/arquitetura.md §6.1–6.9; OpenAPI gerado dos schemas zod
(`src/lib/api-internal/schemas.ts`) em `docs/api-interna.openapi.json` — rodar
`npm run generate:openapi` sempre que um schema mudar (não roda automaticamente no build).

Base: `https://<painel>/api/internal/v1`. `Authorization: Bearer <INTERNAL_API_SECRET>` +
`X-InnoChat-Instance: <webhookToken>` em TODA requisição (`resolveInternalRequest`,
`src/modules/bot-api/internal-auth.ts`) — resolve o tenant SEMPRE pela instância, nunca pelo
corpo. Erro único `{ "error": { "code", "message", "details"? } }`
(`src/lib/api-internal/respond.ts`, que reaproveita os MESMOS códigos de `DomainError` que
`src/modules/agenda/*` já lança desde a Fase 2 — não há vocabulário de erro paralelo).

Rotas (`src/app/api/internal/v1/**`):

- `POST /messages/claim` (`src/modules/bot-api/claim.ts`) — normaliza o payload da Evolution
  (`src/core/bot/evolution-normalize.ts`, função pura), deduplica por `InboundEvent`
  (`whatsappInstanceId, providerMessageId`), adquire a trava da sessão (lease de 20s via `UPDATE
  ... WHERE lockToken IS NULL OR lockedUntil < now()` — atômico no Postgres, sem `SELECT FOR
  UPDATE`), resolve `@lid` (`remoteJidAlt`/`senderPn`, com fallback a `Contact.lid` já
  conhecido), avalia bloqueio por contato/modo humano, eco `fromMe`
  (hash sha256 em `ChatSession.recentOutbound`, janela de 2 min), assinatura
  (`isTenantBotAllowed`, stub — ver PENDÊNCIAS), STALE (>5 min) e expiração de sessão
  (`Tenant.sessionTimeoutMin`). **Nunca 5xx para payload irreconhecível** — testado com fixture
  `garbage.json`.
- `PUT /sessions/{id}` / `POST /sessions/{id}/release` (`src/modules/bot-api/session.ts`) — grava
  e libera a trava (`409 LOCK_LOST` se `lockToken`/`version` não baterem ou a trava venceu);
  `release` é sempre idempotente.
- `GET /catalog/services`, `GET /catalog/services/{serviceId}/professionals`, `GET
  /availability/days`, `GET /availability/slots` (`src/modules/bot-api/booking-bot.ts`) —
  reaproveitam `src/core/agenda` e `src/modules/agenda/availability-loader.ts` (Fase 2) sem
  alteração de lógica, só mudam a FORMA da resposta para `{ options: [{id,label}] }` já
  numerável, com rótulos formatados no fuso/locale do tenant (`src/core/bot/format.ts`). O
  sentinel `{ id: "any", label: "Qualquer profissional" }` em `/catalog/.../professionals`
  significa "profissionalId: null" — quem monta o workflow (Fase 5) precisa traduzir essa opção
  para `professionalId: null` antes de chamar os endpoints seguintes (nunca envie a string
  `"any"` adiante).
- `PATCH /contacts/{contactId}`, `GET /contacts/{contactId}/appointments` — nome 2–60
  caracteres (`INVALID_NAME`); "meus agendamentos" com rótulo `"Ter 30/09 14:30 — Corte
  feminino (Ana)"` **e** (Fase 4b) `serviceId`, `professionalId`, `servico`, `profissional`,
  `data`, `hora` (mesmos formatos de `core/bot/format.ts`) e `startsAt` (ISO) em cada opção —
  aditivo, `label` continua igual.
- `POST /appointments`, `POST /appointments/{id}/cancel`, `POST /appointments/{id}/reschedule`
  (`src/modules/bot-api/booking-bot.ts`) — reaproveitam `createAppointmentManual`/
  `cancelAppointment`/`rescheduleAppointment` de `src/modules/agenda/appointments.ts` (Fase 2,
  ganharam parâmetros opcionais `source`/`whatsappInstanceId`/`authorType` — comportamento
  antigo preservado por padrão). Idempotência e a concorrência de 20 reservas paralelas (1×201 +
  19×409) são as MESMAS garantias da Fase 2 (constraint `EXCLUDE`), só testadas de novo pelo
  caminho do bot em `tests/integration/bot-api.integration.test.ts`. `SLOT_TAKEN` devolve
  `{ alternatives: { date, options } }` — busca no mesmo dia e, se vazio, nos próximos dias
  dentro do horizonte (nunca vazio se existir QUALQUER horário possível).
- `POST /connection-events` — sempre `200`; aplica `open|close|connecting` →
  `CONNECTED|DISCONNECTED|QRCODE` na `WhatsappInstance` já resolvida pelo token. **Não há
  adaptador de chamadas de volta para a Evolution** (isso é Fase 3, ver PENDÊNCIAS) — este
  endpoint só consome o webhook.
- `POST /sandbox/outbox` (+ `GET`, extensão fora de §6.8 — ver PENDÊNCIAS) — só instância
  `sandbox=true` (`403 FORBIDDEN` senão); guardado em memória do processo, TTL 24h (dívida
  registrada em `src/modules/bot-api/sandbox-outbox.ts`).

`BotText` (`src/modules/bot-texts/service.ts`): `getMergedBotTexts(tenantId)` mescla
`DEFAULT_BOT_TEXTS` (pt-BR, `src/core/bot/texts.ts`) com as edições do tenant — usado pelo
`claim`. CRUD como Server Actions (`src/modules/bot-texts/bot-text-actions.ts`,
`listBotTextsAction`/`upsertBotTextAction`/`resetBotTextAction`/`previewBotTextAction`),
guardadas por `requireTenantMember`, **sem tela** nesta fase (para a Lyra construir "Mensagens
do bot" depois). `upsertBotTextAction` valida que só existem variáveis conhecidas
(`{nome} {empresa} {servico} {profissional} {data} {hora} {preco}`) — `INVALID_PAYLOAD` senão.

`fixtures/evolution/*.json`: 9 payloads baseados na documentação pública da Evolution v2 (texto,
extendedTextMessage, `@lid` com/sem alternativa, grupo, mídia, `fromMe`, `connection.update`,
lixo) — **nenhum capturado do servidor real** (Fase 0 ainda não rodou). Ver
`fixtures/evolution/README.md` para o que muda quando os reais chegarem.

## Fase 4b — API interna do bot: buracos de contrato encontrados ao montar o `innochat-bot` no n8n

O workflow real (`n8n/innochat-bot.json`, mapa em `n8n/README.md`) expôs 3 buracos no contrato
da Fase 4 — corrigidos de forma ADITIVA (nada do que o workflow já usa mudou de forma):

1. **`GET /contacts/{contactId}/appointments` agora devolve dados estruturados por opção**, não
   só `{id,label}`. Antes, o nó "Ação escolhida" do n8n extraía `data`/`hora`/`servico`/
   `profissional` do `label` por regex para montar `CONFIRM_CANCEL` — frágil (dependia do
   formato exato do rótulo) e não dava para remarcar (faltava `serviceId`/`professionalId`).
   Cada item agora é `{ id, label, serviceId, professionalId, servico, profissional, data, hora,
   startsAt }` (`data`/`hora` no fuso do tenant, mesmos formatos de `core/bot/format.ts`;
   `startsAt` ISO em UTC). Implementado em `listMyAppointmentOptions`
   (`src/modules/bot-api/booking-bot.ts`).
2. **`tenant.timezone` na resposta `process` do `POST /messages/claim`** — antes só `{ name,
   askProfessional }`; agora `{ name, askProfessional, timezone }`. O placeholder `timezone` do
   nó Config do n8n (`n8n/README.md`) pode ser eliminado a favor deste campo, que nunca fica
   desincronizado do tenant real.
   `GET /availability/days` já aceita `from` **omitido** (novo — antes era obrigatório): nesse
   caso o padrão é "hoje no fuso do tenant", resolvido no backend (`listAvailabilityDayOptions`)
   sem o chamador precisar saber o fuso.
3. **Rótulos estruturais editáveis** — "Confirmar", "Escolher outro horário", "Sim, cancelar",
   "Não, manter", "Ver mais datas", "Mais horários", "Ver mais" e o rodapé "0. Menu principal"
   (hoje hardcoded no Code node "Montar mensagem" do n8n) ganharam chaves `BotText` novas, com
   os MESMOS valores como padrão, devolvidas no mesmo `texts` do claim:
   `LABEL_CONFIRM`, `LABEL_OTHER_TIME`, `LABEL_CANCEL_YES`, `LABEL_CANCEL_NO`,
   `LABEL_MORE_DAYS`, `LABEL_MORE_TIMES`, `LABEL_MORE`, `LABEL_BACK_TO_MENU`
   (`BOT_TEXT_KEYS`/`DEFAULT_BOT_TEXTS` em `src/core/bot/texts.ts`; migration
   `prisma/migrations/20260928000006_bot_text_structural_labels`, `ALTER TYPE ... ADD VALUE`
   aplicada em `innochat` e `innochat_test`). Passam pelo MESMO CRUD/preview de `BotText`
   (`listBotTextsAction`/`upsertBotTextAction`/`resetBotTextAction`/`previewBotTextAction`) sem
   tratamento especial — são texto livre sem `{variavel}` (não fazem parte de
   `BOT_TEXT_VARIABLES`, então `{algo}` neles cai em `INVALID_PAYLOAD` como qualquer variável
   desconhecida). **Descrição humana de cada chave nova, para a tela "Mensagens do bot" (Lyra):**
   - `LABEL_CONFIRM` — botão/opção "Confirmar" na tela de confirmar agendamento.
   - `LABEL_OTHER_TIME` — botão/opção "Escolher outro horário" na tela de confirmar agendamento.
   - `LABEL_CANCEL_YES` — botão/opção "Sim, cancelar" na confirmação de cancelamento.
   - `LABEL_CANCEL_NO` — botão/opção "Não, manter" na confirmação de cancelamento.
   - `LABEL_MORE_DAYS` — opção de paginação "Ver mais datas" na lista de dias disponíveis.
   - `LABEL_MORE_TIMES` — opção de paginação "Mais horários" na lista de horários disponíveis.
   - `LABEL_MORE` — opção de paginação genérica "Ver mais" (menus com mais de 9 itens).
   - `LABEL_BACK_TO_MENU` — rodapé "0. Menu principal" que aparece nas telas do bot.

   A implementação do lado do n8n (trocar o hardcode de `MENUS`/footer/paginação no Code node
   "Montar mensagem" por `texts.LABEL_*`) **não foi feita nesta rodada** — é trabalho no
   workflow, fora do escopo de backend; o contrato já está pronto para consumir.

## Rotas HTTP do navegador previstas (Fase 2+)

- `GET /api/whatsapp/instances/{id}/state` cogitada em docs/arquitetura.md §6.10 — **não virou
  rota HTTP**: implementada como Server Action (`getQrCodeAction`/`refreshConnectionStatusAction`,
  ver "WhatsApp (Fase 3)" abaixo), mesmo raciocínio de `listAvailableSlotsAction` (Fase 2):
  Server Actions já servem Client Components, sem precisar de uma rota HTTP separada.
- `GET /api/agenda/slots?…` (Fase 2 — na prática coberto por `listAvailableSlotsAction`, ver
  seção "Catálogo e agenda" acima; não virou rota HTTP separada)

Implementadas na Fase 7 (ver seção "Cobrança e cadastro público" mais abaixo):

- `POST /api/webhooks/mercadopago`
- `POST /api/internal/v1/billing/tick`

---

## WhatsApp (Fase 3) — conexão por QR code

Implementado. Contrato completo em docs/arquitetura.md §4, §7.3 regra 4, §8 "Configuração pela
plataforma". Modelos (`WhatsappInstance`, `TrialClaim`) já existiam (Cronos, Fase 1/schema
inicial) — esta fase implementa o adaptador Evolution, a lógica de negócio e as Server Actions;
sem tela (a Lyra consome o contrato abaixo).

### `src/modules/whatsapp/evolution-client.ts` — adaptador Evolution API v2

Interface isolada (`EvolutionClient`) e mockável — nenhum outro módulo importa `fetch` para a
Evolution direto, tudo passa por aqui (mesmo padrão de `MercadoPagoGateway`,
`src/modules/billing/mercadopago.ts`). Timeout de 15s, até 3 tentativas com retry **só** em 5xx e
falha de rede/timeout (nunca em 4xx). O corpo de erro da Evolution NUNCA entra em log nem na
mensagem da exceção (pode ecoar PII do payload) — só status + path + um `correlationId`.

- `createInstance(instanceName)` — `POST /instance/create` (`integration: "WHATSAPP-BAILEYS"`,
  `qrcode: true`, `groupsIgnore: true`, `readMessages: false`, `alwaysOnline: false`). NÃO
  configura webhook (passo separado, abaixo) — permite compensar (apagar) a instância se o
  passo do webhook falhar, sem confundir "criou mas sem webhook útil" com "criou certo".
- `setWebhook(instanceName, webhookUrl)` — `POST /webhook/set/{instance}`, sempre explícito
  depois do `createInstance` (docs/arquitetura.md §4): `{ webhook: { enabled: true, url,
  byEvents: false, base64: false, events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"] } }`.
- `connect(instanceName)` — `GET /instance/connect/{instance}` → `{ qrCodeDataUrl: string | null,
  pairingCode: string | null }`. `qrCodeDataUrl` sempre em formato `data:image/png;base64,...`
  (aceita base64 cru ou data URL completa da Evolution, normaliza para o mesmo formato). `null`
  quando a instância já está conectada (não há QR).
- `connectionState(instanceName)` — `GET /instance/connectionState/{instance}` → string bruta
  (`"open" | "connecting" | "close" | ...`); mapeamento para o enum do domínio é
  `mapEvolutionState` (`src/core/whatsapp/connection-event.ts`).
- `fetchOwnerJid(instanceName)` — `GET /instance/fetchInstances?instanceName=` → JID do dono
  (`ownerJid`/`owner`/`instance.owner`, conforme a versão) ou `null`.
- `logout(instanceName)` — `DELETE /instance/logout/{instance}` (mantém a instância, só encerra
  a sessão — permite reconectar com um QR novo).
- `deleteInstance(instanceName)` — `DELETE /instance/delete/{instance}` (remove de vez; usado no
  "Remover" da tela e na compensação de um `create` que falhou no meio).

`getEvolutionClient()` resolve `baseUrl`/`apiKey` de `PlatformSettings` (§8 — nada em env var);
lança `DomainError("EVOLUTION_NOT_CONFIGURED", …)` se faltar.

⚠️ **HONESTIDADE SOBRE O QUE FOI VERIFICADO**: implementado a partir da documentação pública da
Evolution API v2 e do adaptador validado AO VIVO no InnoAtendente (2026-09-04,
`C:\Projetos\Web\InnoAtendente\src\adapters\whatsapp\evolution\index.ts`). **Sem servidor
Evolution real do InnoChat conectado nesta rodada** — todo formato de resposta está marcado com
`SUPOSIÇÃO:` no código, e os testes unitários (`evolution-client.test.ts`) usam fixtures **não
capturadas de um servidor real**. Confirmar contra um servidor de verdade antes de confiar
cegamente em produção (mesma pendência que a Fase 0 da arquitetura já registra para o resto do
sistema).

### `src/core/whatsapp/*` — normalização pura (sem I/O)

- `phone.ts#normalizePhoneFromJid(jid)` — `"5511999999999@s.whatsapp.net"` → `"+5511999999999"`,
  com a MESMA correção do 9º dígito brasileiro validada ao vivo no InnoAtendente (2026-09-05):
  reconstitui o 9 que falta em `subscriber` de 8 dígitos, só para `+55`. `null` para JID vazio.
- `instance-name.ts#buildInstanceName(tenantSlug, randomSuffix)` — `innochat-<slug≤20>-<curto>`
  (prefixo `innochat-` obrigatório: Evolution compartilhada com o InnoAtendente). Recebe o
  sufixo aleatório já gerado pelo chamador (I/O de `crypto` fica na camada de serviço) — função
  pura, testável sem mockar `crypto`.
- `connection-event.ts`:
  - `mapEvolutionState(state)` — `"open"→CONNECTED`, `"connecting"→QRCODE`,
    `"close"/"closed"→DISCONNECTED`, resto → `null`.
  - `resolveNextConnectionStatus(currentStatus, mapped)` — só regride para `DISCONNECTED`
    quando o status LOCAL já era `CONNECTED` (queda real, §4 passo 5). Uma instância que nunca
    conectou fica em `close` o tempo todo esperando o QR ser escaneado — isso NÃO é "queda", e
    regredir confundiria a tela. Usada pelo POLLING (`service.ts`); o webhook
    (`connection-events.ts`) aplica o status bruto direto, sem essa heurística — um evento da
    Evolution é fidedigno, uma consulta pode pegar um instante intermediário.
  - `parseConnectionEvent(rawBody)` — normaliza o webhook `connection.update`/`CONNECTION_UPDATE`
    para `{ state, ownerJid }`. **Ignora o campo `instance` do corpo de propósito**: quem chama
    já resolveu a instância pelo `webhookToken` do path (`X-InnoChat-Instance`) — exigir esse
    campo aqui duplicaria uma verificação que já existe, e um payload real sem ele (ou atrás de
    `byEvents:true`) não pode virar um falso negativo. Nunca lança; payload irreconhecível → `null`.

### `src/modules/whatsapp/connection.ts` — TrialClaim compartilhado

`applyConnectedNumber({ tenantId, instanceId, instanceName, phoneE164, evolution? })` —
**compartilhado** pelo polling do dashboard (`getQrCode`/`refreshConnectionStatus`) E pelo
webhook (`POST /connection-events`), para a regra de "um trial por número" nunca ficar
desalinhada entre os dois caminhos que podem detectar uma conexão (docs/arquitetura.md §7.3
regra 4, lição "estender função de domínio compartilhada, não forkar").

- Só age quando `effectiveStatusForTenant(tenantId) === "TRIALING"`. Fora do trial, só aplica
  `status: CONNECTED` + `phoneE164` + `lastConnectedAt`, sem tocar `TrialClaim`.
- Em trial: busca `TrialClaim(phoneE164)`.
  - Não existe → cria `TrialClaim(phoneE164, tenantId)` (corrida entre dois caminhos detectando
    a mesma conexão ao mesmo tempo — webhook E polling — é absorvida pela constraint
    `@unique(phoneE164)`, mesmo padrão de `isUniqueViolation` do `claim` da Fase 4).
  - Existe e é da MESMA empresa (reconectando) → segue normalmente.
  - Existe e é de OUTRA empresa → **bloqueia**: marca a instância local `DISCONNECTED` (sem
    telefone), chama `evolution.logout(instanceName)` (melhor esforço — falha só loga, nunca
    impede o bloqueio local) e devolve `{ blocked: true, reason: "TRIAL_PHONE_ALREADY_USED" }`.

### `src/modules/whatsapp/service.ts` — camada de serviço

- `listWhatsappInstances(tenantId)` — só `deletedAt: null`, ordenado por `createdAt`.
- `createWhatsappInstance({ tenantId, tenantSlug, label, evolution? })` — ordem deliberada
  (mission "sem instância órfã: compense ou marque para limpeza"):
  1. `assertCanAddWhatsappNumber(tenantId)` (`src/modules/billing/plan-limits.ts`, Fase 7) —
     falha ANTES de qualquer chamada externa.
  2. `n8nWebhookBaseUrl`/URL pública configuradas (`PUBLIC_URL_UNKNOWN`/`N8N_NOT_CONFIGURADO`
     unificados em `N8N_NOT_CONFIGURED`, mensagem "configure o n8n na área de administração") —
     nunca cria uma instância sem webhook por falta de configuração da plataforma (§8).
  3. `evolution.createInstance(instanceName)`.
  4. `evolution.setWebhook(instanceName, webhookUrl)` — falhou → compensa (`deleteInstance`) e
     relança; nada é gravado localmente.
  5. Grava `WhatsappInstance` local (`status: QRCODE`) — falhou (infra) → compensa a Evolution
     também: nunca deixa uma instância órfã lá enquanto o painel não sabe que ela existe.
  A compensação é melhor esforço: se o `deleteInstance` de limpeza também falhar, loga
  `whatsapp.create.compensation_failed` para o admin limpar manualmente (dívida consciente —
  não há fila de retry nesta rodada).
- `getQrCode(tenantId, instanceId, { evolution? })` — o QR expira e o cliente consulta a cada
  ~3s (docs/arquitetura.md §4): **nunca cacheamos o QR localmente**, sempre `connectionState` +,
  se ainda não conectado, um `connect()` fresco a cada chamada. Se `connectionState` disser
  `open`, busca o dono (`fetchOwnerJid`) e aplica via `applyConnectedNumber` — bloqueado por
  `TrialClaim` vira `{ status: "DISCONNECTED", blockedReason: "TRIAL_PHONE_ALREADY_USED" }` (a
  Lyra mostra essa mensagem na tela, sem QR novo).
- `refreshConnectionStatus(tenantId, instanceId, { evolution? })` — igual, sem buscar QR (mais
  barato; "Verificar agora"/atualização de status pura).
- `disconnectWhatsapp`/`removeWhatsappInstance` — chamam `logout`/`deleteInstance` na Evolution
  como MELHOR ESFORÇO (falha remota não impede a atualização local — o usuário pediu para
  desconectar/remover, e mesmo que a Evolution já não tenha a instância, o painel precisa
  refletir a intenção). `remove` é soft delete (`deletedAt`), nunca perde o histórico.
- `setSandbox(tenantId, instanceId, sandbox)` — sem chamada à Evolution, só a coluna local.

### Server Actions (`src/modules/whatsapp/actions.ts`)

Leitura aberta a qualquer membro do tenant; MUTAÇÃO restrita a `OWNER`
(`requireTenantMember(slug, ["OWNER"])`) — decisão de infraestrutura da empresa, mesmo nível de
`updateTenantThemeAction`.

- `listWhatsappInstancesAction(tenantSlug): Result<WhatsappInstanceView[]>`
- `createWhatsappInstanceAction(tenantSlug, { label }): Result<WhatsappInstanceView>` — exige
  `requireVerifiedEmail()` **ANTES** de `requireTenantMember(..., ["OWNER"])` (docs/arquitetura.md
  §7.3 regra 2: "sem e-mail verificado, não é possível conectar WhatsApp" — a ordem garante que
  um usuário sem e-mail verificado recebe sempre `EMAIL_NOT_VERIFIED`, independente de ser ou
  não `OWNER` ali, sem vazar permissão). Também chama `assertTenantCanWrite` (bloqueado se a
  assinatura estiver `SUSPENDED`/`CANCELED`). Erros: `EMAIL_NOT_VERIFIED`, `FORBIDDEN` (não é
  `OWNER`), `NOT_FOUND` (empresa/membership), `TENANT_SUSPENDED`, `PLAN_LIMIT_REACHED` (`details:
  { rule: "maxWhatsappNumbers", limit, current }`), `N8N_NOT_CONFIGURED`,
  `EVOLUTION_NOT_CONFIGURED`, `INVALID_PAYLOAD`.
- `getQrCodeAction(tenantSlug, instanceId): Result<QrCodeView>` — `QrCodeView: { status, 
  qrCodeDataUrl, pairingCode, phoneE164, blockedReason }`. Consultado pelo Client Component a
  cada ~3s enquanto `status !== "CONNECTED"` (a Lyra decide o intervalo e o corte em ~2min, ver
  docs/arquitetura.md §4 passo 2). Erro: `NOT_FOUND` (instância não é deste tenant, ou removida).
- `refreshConnectionStatusAction(tenantSlug, instanceId): Result<ConnectionStatusView>` —
  `{ status, phoneE164, blockedReason }`, sem QR.
- `disconnectWhatsappAction(tenantSlug, instanceId): Result<WhatsappInstanceView>`
- `removeWhatsappInstanceAction(tenantSlug, instanceId): Result<{ id }>`
- `setSandboxAction(tenantSlug, instanceId, { sandbox }): Result<WhatsappInstanceView>`

`WhatsappInstanceView`: `{ id, label, instanceName, status, phoneE164, sandbox,
lastConnectedAt, createdAt }` (datas em ISO string).

### `POST /connection-events` (Fase 4 + Fase 3, completo)

`src/modules/bot-api/connection-events.ts`. Já existia (Fase 4, só `status`); esta rodada
completa a cobertura pedida: número conectado (`ownerJid`/`wuid`) e `TrialClaim`.

- `state === "CONNECTED"` (evento `open`): se o payload trouxer `wuid`, normaliza o telefone e
  chama `applyConnectedNumber` (mesma função do polling — TrialClaim incluído). **Sem `wuid`
  neste evento específico** (a Evolution às vezes manda `connection.update` sem o dono
  preenchido), aplica só `status: CONNECTED` + `lastConnectedAt` — o telefone/TrialClaim são
  resolvidos no próximo poll do dashboard (comportamento herdado da Fase 4, mantido para não
  quebrar o contrato já testado).
- `state !== "CONNECTED"` (`connecting`/`close`): aplica o status bruto diretamente
  (`QRCODE`/`DISCONNECTED`) — **sem** a heurística "só regride de CONNECTED" usada pelo polling
  (`resolveNextConnectionStatus`): um evento da Evolution é fidedigno; a heurística existe só
  para não regredir por causa de um instante intermediário de uma CONSULTA de polling.
- Sempre `200`/`{ applied: boolean }`, nunca lança — payload irreconhecível ou `state`
  desconhecido → `{ applied: false }`.

### Migration

`20260928000008_platform_n8n_cron_workflow` — não é desta feature (ver "Sincronização do n8n"
abaixo); `WhatsappInstance`/`TrialClaim` já existiam desde o schema inicial (Cronos), sem
migration nova nesta rodada.

### PENDÊNCIAS (Fase 3)

- **Sem servidor Evolution real conectado** — todo o adaptador foi testado com `fetch` mockado;
  falta confirmar os formatos de resposta (`connect`, `connectionState`, `fetchInstances`,
  `webhook/set`) contra uma instância de verdade antes de confiar em produção (mesma pendência
  da Fase 0 da arquitetura, nunca resolvida por falta de servidor disponível nesta sessão).
- **Sem tela** — Lyra consome o contrato acima (Server Actions prontas) para montar "Painel ›
  WhatsApp › Conectar número" (docs/arquitetura.md §4).
- `emailDomain` de `TrialClaim` nunca é preenchido (`null` sempre) — o schema tem o campo, mas
  nada nesta rodada o popula; simplificação consciente (o `phoneE164` já é a defesa principal).

## Sincronização do n8n — `innochat-cron` (Fase 3, acréscimo pontual)

`src/modules/platform/n8n-sync.ts` (Fase 5+, já existia) ganhou um terceiro workflow opcional:
`innochat-cron` (`n8n/README.md` — Schedule de hora em hora → nó `Config cron` → `POST
{painelUrl}/billing/tick`, credencial "InnoChat Painel (Bearer)", sem `X-InnoChat-Instance`).

- `syncN8n()` agora também resolve `innochat-cron` por id salvo (`PlatformSettings.n8nWorkflowCronId`)
  → id de fábrica (`dPMhT4MqGglCpFSw`, `n8n/README.md`) → nome — **NUNCA lança se não achar**
  (`tryResolveWorkflow`, diferente de `resolveWorkflow` usado para bot/erros): o cron é opcional,
  a sync não pode falhar por causa dele. Quando não encontrado, `N8nSyncSummary.warnings` ganha
  uma mensagem e `n8nWorkflowCronId` no banco fica como estava (nunca apaga uma referência válida
  por uma falha transitória de busca).
- Quando encontrado: escreve `painelUrl` no nó `Config cron` e reata a credencial do painel no
  nó HTTP `Chamar billing/tick` (só o grupo "painel" — o cron não conhece Evolution nem n8n API).
- `activateBotWorkflow()`/`deactivateBotWorkflow()` publicam/despublicam o `innochat-cron` JUNTO
  com o `innochat-bot` (mesma chamada). Sem cron sincronizado ainda, pula essa parte
  silenciosamente (não é erro — só o bot precisa estar sincronizado).
- `N8nSyncSummary` ganhou `cronWorkflowId: string | null` e `warnings: string[]`.

Migration `20260928000008_platform_n8n_cron_workflow` — `PlatformSettings.n8nWorkflowCronId`
(nullable), aplicada em `innochat` e `innochat_test`; `DOWN.sql` presente.

Testado em `tests/integration/platform-n8n-sync.integration.test.ts` (fake server): sincroniza
`Config cron`/credencial quando o workflow existe; não falha e avisa quando não existe;
`activateBotWorkflow` não falha quando o cron nunca foi sincronizado.

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

## Fase 4 — API interna do bot: o que a Íris deve testar

- `npm run test:integration` cobre (`tests/integration/bot-api.integration.test.ts`):
  autenticação (`resolveInternalRequest` — sem Bearer, segredo errado, sem
  `X-InnoChat-Instance`, token de instância inexistente → sempre 401); dedupe do mesmo
  `providerMessageId` 2x → `DUPLICATE` na segunda, e só 1 `InboundEvent` gravado; claim
  concorrente do mesmo contato → uma execução `busy`; isolamento entre tenants (mesmo JID e
  mesmo `providerMessageId` em duas instâncias de tenants diferentes NÃO cruzam
  `Contact`/`ChatSession`); `@lid` sem alternativa e sem `Contact.lid` conhecido →
  `UNRESOLVABLE_SENDER`; `PUT /sessions/{id}` com `lockedUntil` vencido OU `version` errada →
  `LOCK_LOST`, e com os dois corretos grava e libera a trava; 20 reservas paralelas pelo caminho
  do bot → exatamente 1 sucesso + 19 `SLOT_TAKEN` com `alternatives.{date,options}`;
  idempotência de `POST /appointments`; `contactId` de outro tenant → `NOT_FOUND`.
- **Não coberto ainda** (a Íris deve somar, quando fizer sentido): eco `fromMe` (hash bate com
  saída recente) e "humano assume" (`fromMe` sem eco); `BOT_PAUSED`/`HUMAN_MODE`; expiração de
  sessão (`sessionTimeoutMin`); `STALE` (>5 min); `TOO_LATE` em cancelar/remarcar pelo bot;
  `PATCH /contacts/{contactId}` (nome 2–60); `/connection-events`; `/sandbox/outbox`. A lógica já
  existe e está coberta por revisão de código, mas depende de manipular tempo/relógio nos
  testes — vale a pena a Íris decidir se usa `vi.useFakeTimers()` ou parâmetros injetáveis.
- Rodar o `POST /messages/claim` de verdade contra as 9 fixtures de `fixtures/evolution/` (só
  chamando `claimMessage` direto, como os testes acima) é o teste de regressão do dia em que os
  payloads REAIS da Fase 0 substituírem essas fixtures — se algum campo mudar de nome, um teste
  quebra e aponta exatamente onde mexer em `src/core/bot/evolution-normalize.ts`.

## Fase 4 — API interna do bot: o que o Órion deve revisar

- `src/modules/bot-api/internal-auth.ts`: comparação do segredo é via
  `verifyInternalApiSecret` (`crypto.timingSafeEqual`, já revisado na Fase 1); toda falha de
  auth é `401` — nunca `403` (não confirma nada sobre existência de recursos a quem não está
  autenticado).
- `src/modules/bot-api/claim.ts`: a trava é uma `updateMany` condicional
  (`WHERE lockToken IS NULL OR lockedUntil < now()`) — não um `SELECT ... FOR UPDATE` — checar
  que a leitura de `count === 0` como "não adquiriu" está certa (Postgres serializa dois
  `UPDATE`s concorrentes na mesma linha: o segundo só reavalia o `WHERE` depois que o primeiro
  comita). `isUniqueViolation` detecta `P2002` por assinatura (`constructor.name` + `.code`),
  mesmo padrão de `isExclusionViolation` (Fase 2) — ver
  `.claude/agent-memory/vega/prisma_exclude_violation_shape.md`.
- `src/core/bot/evolution-normalize.ts`: puro, nunca lança — todo caminho de payload inválido
  vira `{ kind: "unsupported" }`; é essa garantia que sustenta "claim nunca devolve 5xx".
- `src/modules/bot-texts/service.ts` (`upsertBotText`): `assertKnownVariables` bloqueia
  `{variavelDesconhecida}` no texto ANTES de salvar — checar que a lista
  `BOT_TEXT_VARIABLES` (`src/core/bot/texts.ts`) continua sincronizada com o que
  `renderTemplate` de fato substitui.
- `src/modules/agenda/appointments.ts`: os novos parâmetros opcionais `source`/
  `whatsappInstanceId`/`authorType` em `createAppointmentManual`/`cancelAppointment`/
  `rescheduleAppointment` — confirmar que omiti-los preserva EXATAMENTE o comportamento antigo
  (PANEL/USER), e que o caminho do bot (`src/modules/bot-api/booking-bot.ts`) sempre passa
  `authorType: "CONTACT"` com `actorId = contact.id` (nunca um id de `User`).
- Dívidas conscientes registradas nesta fase (avaliar se são aceitáveis): `isTenantBotAllowed`
  é stub `true` fixo (`src/modules/bot-api/subscription-gate.ts`, TODO Fase 7); sandbox outbox
  em memória do processo, sem tabela (`src/modules/bot-api/sandbox-outbox.ts`); fixtures da
  Evolution não capturadas do servidor real (`fixtures/evolution/README.md`).

---

## Fase 7 — Cobrança e cadastro público

Modelos (`Plan`, `Subscription`, `Invoice`, `ProviderEvent`, `TrialClaim`) já existiam
(Cronos, ver `.claude/agent-memory/cronos/fase7_cobranca_decisoes.md`). Esta fase implementa a
lógica de negócio, e-mail transacional, o adaptador do Mercado Pago e o cadastro público —
sem telas (a Lyra consome o contrato abaixo).

### `src/core/billing` — domínio puro (sem I/O)

- `effectiveStatus(subscription: { status, trialEndsAt, currentPeriodEnd }, now: Date):
  "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED"` — status EFETIVO calculado sob
  demanda (§7.4). `CANCELED` é terminal. Regras: `TRIALING` até `trialEndsAt`; depois disso (ou
  depois de `currentPeriodEnd`, para quem já não está mais em trial), 1 dia de carência
  (`GRACE_DAYS`) → `PAST_DUE`, depois `SUSPENDED`, depois de 60 dias em `SUSPENDED`
  (`CANCEL_AFTER_SUSPENDED_DAYS`) → `CANCELED`. Testes: `src/core/billing/__tests__/status.test.ts`.
- `computeTrialEndsAt(signupAt): Date` — `+1 dia` (decisão do dono, 2026-09-28).
- `computeNextPeriodEnd({ currentPeriodEnd, wasSuspended, paidAt }): Date` — `+1 mês` a partir de
  `currentPeriodEnd` (mantém o dia-âncora) OU a partir de `paidAt` se `wasSuspended` (§7.1).

### `src/core/signup/slug.ts` — validação de endereço da empresa (pura)

- `RESERVED_SLUGS` — lista fechada (`login`, `cadastro`, `pos-login`, `admin`, `api`, `app`,
  `www`, `assets`, `static`, `public`, `convite`, `recuperar-senha`, `verificar-email`,
  `sitemap`, `robots`, `favicon.ico`, `manifest`, `_next`, `webhooks`, `internal`).
- `slugify(name): string` — normaliza (acentos, espaços, maiúsculas) sem checar unicidade/reserva.
- `validateSlug(slug): "TOO_SHORT" | "TOO_LONG" | "INVALID_FORMAT" | "RESERVED" | null` — só
  formato/reserva; unicidade no banco é responsabilidade do `service.ts` (I/O).

### `src/lib/email` — SMTP próprio via nodemailer

- `sendMail({ to, subject, html, text }): Promise<{ sent: boolean }>` (`src/lib/email/mailer.ts`)
  — lê `PlatformSettings.smtp*`. Lança `SmtpNotConfiguredError` (`DomainError`,
  `SMTP_NOT_CONFIGURED`) se faltar configuração; qualquer outro erro (SMTP fora do ar) é
  capturado, logado (sem `to`/segredo) e devolve `{ sent: false }` — nunca lança, nunca derruba
  quem chamou.
- Templates pt-BR (`src/lib/email/templates.ts`): `verificationEmail`, `passwordResetEmail`,
  `teamInviteEmail`, `invoiceGeneratedEmail`, `invoiceDueReminderEmail`,
  `subscriptionSuspendedEmail` — cada um devolve `{ subject, html, text }`.

### `src/modules/billing` — assinatura, fatura, Pix, limites

- `getDefaultSignupPlan()` — plano de menor `sortOrder` (Essencial), mesmo com `active: false`
  (o trial funciona antes do dono definir preço).
- `effectiveStatusForTenant(tenantId, now?)`, `assertTenantCanWrite(tenantId, now?)` — lança
  `DomainError("TENANT_SUSPENDED", …)` quando o status efetivo é `SUSPENDED`/`CANCELED`. Já
  aplicada em toda Server Action de MUTAÇÃO de `src/modules/agenda/catalog-actions.ts` e
  `appointment-actions.ts` (painel só-leitura quando suspenso, §7.4) — chamar SEMPRE depois de
  `requireTenantMember`.
- `isTenantBotAllowedFor(tenantId, now?): Promise<boolean>` — para o Atlas ligar no lugar do
  `TODO` de `src/modules/bot-api/subscription-gate.ts` (não editado aqui, por instrução).
- `src/modules/billing/plan-limits.ts`: `assertCanAddProfessional(tenantId)` (já chamada em
  `createProfessional`, `src/modules/agenda/catalog.ts`) e `assertCanAddWhatsappNumber(tenantId)`
  (exportada para a Fase 3 chamar antes de criar uma `WhatsappInstance`). Override de `Tenant`
  tem precedência sobre o limite do `Plan`; `null` (nos dois) = ilimitado. Erro:
  `PLAN_LIMIT_REACHED` com `details: { rule, limit, current }`.
- `src/modules/billing/mercadopago.ts`: interface `MercadoPagoGateway` (`createPixPayment`,
  `getPayment`) — implementação real (`createMercadoPagoGateway`, timeout 10s + retry 3x só em
  5xx/timeout) e `getMercadoPagoGateway()` (lê `PlatformSettings.mercadoPagoAccessToken`, lança
  `MERCADOPAGO_NOT_CONFIGURED` se faltar). `verifyMercadoPagoSignature` valida `x-signature`
  (`ts=…,v1=…`, HMAC-SHA256 do manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
  conforme a documentação oficial do MP — ver comentário no código, PENDÊNCIAS abaixo sobre
  credenciais reais). `src/modules/billing/mercadopago.mock.ts`
  (`createMockMercadoPagoGateway()`) — fake para testes, com `approve(paymentId)`.
- `applyInvoicePayment(invoiceId, paidAt): Promise<{ alreadyProcessed: boolean }>` — idempotente
  (fatura já `PAID` → não faz nada); avança `currentPeriodEnd` (`computeNextPeriodEnd`) e volta a
  assinatura para `ACTIVE`.
- `regeneratePixForInvoice(invoiceId, payerEmail, gateway?)` — só para fatura `OPEN`; mesma
  linha, nunca cria outra.

### Cadastro público (`src/modules/signup`)

- `signUpAction(input): Result<{ tenantSlug }>` — `input: { companyName, slug, segment?,
  ownerName, email, password, termsVersion, acceptedTerms: true }`. Cria `User(OWNER)` +
  `Tenant` + `Membership` + `Subscription(TRIALING, +1 dia)` + a primeira fatura (Pix, se o MP
  estiver configurado) numa transação; e-mail de verificação e de fatura gerada são efeitos
  colaterais fora da transação (nunca desfazem o cadastro se falharem). Rate limit: 5
  cadastros/hora por IP (`RATE_LIMITED`, `details.retryAfterMs`). Erros: `INVALID_SLUG`
  (`details.rule`), `EMAIL_TAKEN`, `SLUG_TAKEN`, `INVALID_PAYLOAD`.
- `verifyEmailAction({ token }): Result<{ tenantSlug: string | null }>` — token de uso único
  (`AuthToken`, hash SHA-256, 48h). Erro: `TOKEN_INVALID` (inválido, expirado OU já usado —
  mesma mensagem, sem distinguir).
- `requestPasswordResetAction({ email }): Result<{ requested: true }>` — sempre `ok`, mesmo se o
  e-mail não existir (sem enumeration). Token de 1h (§7.3 regra 5). Rate limit: 5/hora por IP.
- `resetPasswordAction({ token, password }): Result<{ done: true }>`.
- `inviteTeamMemberAction(tenantSlug, { email, role }): Result<{ invited: true }>` — restrito a
  `OWNER`. Token de 7 dias (§7.3 regra 6). Erro: `ALREADY_MEMBER`.
- `acceptInviteAction({ token, password }): Result<{ tenantSlug: string | null }>`.
- `requireVerifiedEmail()` (`src/lib/auth/guards.ts`) — guarda para a Fase 3 chamar antes de
  conectar WhatsApp; lança `EMAIL_NOT_VERIFIED` se `User.emailVerifiedAt` for nulo.

### `POST /api/webhooks/mercadopago`

Sem autenticação por segredo — a autenticação É a assinatura `x-signature` (`verifyMercadoPagoSignature`
contra `PlatformSettings.mercadoPagoWebhookSecret`). Fluxo: valida assinatura → RECONSULTA o
pagamento na API do MP (nunca confia no corpo) → idempotência por
`ProviderEvent(provider="mercadopago", providerEventId=data.id)` → se `approved`, `applyInvoicePayment`.
Resposta sempre `200` para o MP (mesmo `ignored`), exceto assinatura inválida (`401`) — corpo
irreconhecível nunca é 5xx (mesma régua do `claim`, §6.2).

### `POST /api/internal/v1/billing/tick`

Mesma autenticação da API interna do bot (`Authorization: Bearer <INTERNAL_API_SECRET>`), SEM
`X-InnoChat-Instance` (não é escopado a uma instância — varre todas as assinaturas). Chamado por
um cron externo (n8n Schedule Trigger, fora deste repo), de hora em hora. Resposta 200:
`{ invoicesCreated, pixRegenerated, remindersSent, statusChanges, suspensionEmailsSent }`
(`src/modules/billing/tick.ts`, `BillingTickSummary`). Idempotente por desenho: fatura por
`@@unique([subscriptionId, periodStart])`; e-mail de lembrete/suspensão por marca
`*EmailSentAt` (`Invoice.dueReminderEmailSentAt`/`dueTodayEmailSentAt`,
`Subscription.suspendedEmailSentAt` — migration `20260928000005_billing_email_idempotency`);
avanço de mês só pelo pagamento (`applyInvoicePayment`), nunca pelo tick.

**Nota de coordenação:** este arquivo mora em `src/app/api/internal/v1/billing/tick/route.ts` —
mesma árvore de diretório da API do bot (Fase 4), rodando em paralelo nesta sessão. Arquivo NOVO
e isolado, sem tocar em `messages/`, `sessions/`, `appointments/`, etc. da Fase 4. Sinalizado aqui
para o Atlas confirmar que não houve concorrência de edição no mesmo arquivo.

### Admin de planos e empresas (`src/modules/billing/admin-actions.ts`) — Server Actions

Todas guardadas por `requirePlatformAdmin()`.

- `listPlansAction(): Result<Plan[]>`.
- `updatePlanAction(planId, input): Result<Plan>` — `input` parcial de `{ name, priceCents,
  maxWhatsappNumbers, maxProfessionals: number | null, active, sortOrder }`.
- `listCompaniesAction({ cursor?, limit? }): Result<{ items: CompanyListItem[]; nextCursor:
  string | null }>` — paginado (`limit` máx. 100, padrão 30), cursor por `tenantId`. Cada item
  traz `persistedStatus` E `effectiveStatus` (podem divergir até o próximo tick).
- `suspendCompanyAction(tenantId): Result<{ tenantId }>` — força `SUSPENDED` mesmo antes do
  vencimento (empurra `currentPeriodEnd` para o passado — ver comentário em
  `admin-service.ts`; um pagamento futuro sempre conta a partir de `paidAt`, então isso nunca
  "vaza" pro próximo ciclo cobrado).
- `reactivateCompanyAction(tenantId): Result<{ tenantId }>` — volta para `ACTIVE` com +1 mês a
  partir de hoje.
- `extendTrialAction(tenantId, { extraDays: 1-30 }): Result<{ tenantId }>` — só válido enquanto
  `TRIALING`; também empurra o vencimento da fatura do trial.

### O que a Íris deve testar (Fase 7)

- Unitários: `src/core/billing/__tests__/status.test.ts` (16 casos: fronteiras exatas de
  carência/suspensão/cancelamento, `CANCELED` terminal, `computeNextPeriodEnd` com/sem
  suspensão) e `src/core/signup/__tests__/slug.test.ts` (26 casos: normalização, todos os slugs
  reservados, formato).
- Integração (`npm run test:integration`, requer `TEST_DATABASE_URL` — ver
  `.claude/agent-memory/vega/integration_tests_setup.md`):
  - `tests/integration/billing-signup.integration.test.ts` — cadastro completo (User/Tenant/
    Membership/Subscription/Invoice/Pix), `INVALID_SLUG`/`EMAIL_TAKEN`/`SLUG_TAKEN`, verificação
    de e-mail (token de uso único, reuso falha), Mercado Pago fora do ar não quebra o cadastro.
  - `tests/integration/billing-webhook.integration.test.ts` — assinatura inválida → 401 sem
    tocar no banco; MESMO evento processado 2x → 1 baixa só (não avança 2 meses);
    `applyInvoicePayment` chamado 2x direto também idempotente.
  - `tests/integration/billing-tick.integration.test.ts` — geração de fatura 5 dias antes
    (2 rodadas → 1 fatura só); TRIALING não gera fatura extra (já tem a do cadastro);
    regeneração de Pix expirado; reconciliação de status (TRIALING vencido → PAST_DUE);
    e-mail de suspensão 1x só mesmo com o tick rodando várias vezes; limite de profissionais por
    plano (bloqueia e libera com override de `Tenant`).
  - **Nota de infraestrutura de teste**: `vitest.integration.config.ts` agora roda os arquivos
    de `tests/integration/**` SEQUENCIALMENTE (`fileParallelism: false`) — `billing/tick` faz
    varredura GLOBAL de `Subscription`/`Invoice` (sem filtro de tenant, de propósito, é o que
    tick faz em produção), e rodar em paralelo com o `afterAll` de outro arquivo limpando tenants
    causava "Inconsistent query result" (relação obrigatória cortada no meio de um include, por
    uma corrida real entre dois arquivos de teste — não é bug de produção).
  - Observado durante esta sessão: `tests/integration/bot-api.integration.test.ts` (Fase 4, não
    editado aqui) teve UMA falha flaky no teste de concorrência de `POST /appointments` (esperava
    1 sucesso, achou 0) rodando depois de todo o resto da suíte; rodado isolado ou numa segunda
    rodada completa, passou. Parece sensibilidade a timing/carga acumulada de conexões, não um
    bug de isolamento — vale a Íris confirmar rodando a suíte completa mais algumas vezes.
- Ainda sem teste automatizado (fora do escopo desta rodada — sinalizar para quem pegar):
  `inviteTeamMemberAction`/`acceptInvite` (convite de equipe), `requestPasswordResetAction`/
  `resetPasswordAction`, `admin-actions.ts` (planos/empresas — cobertos só por `tsc`/lint/build,
  sem integração dedicada).

### O que o Órion deve revisar (Fase 7)

- `verifyMercadoPagoSignature` (`src/modules/billing/mercadopago.ts`) foi escrito a partir do
  formato documentado (`ts=…,v1=…`, HMAC-SHA256 do manifest), **não temos credenciais reais do
  Mercado Pago para validar contra um webhook de verdade ainda** — PENDÊNCIA explícita: confirmar
  contra a documentação oficial atualizada e, quando houver conta de sandbox, testar
  ponta a ponta antes de habilitar em produção.
- `suspendCompanyManually`/`reactivateCompanyManually` (`src/modules/billing/admin-service.ts`)
  manipulam `currentPeriodEnd` diretamente para forçar o `effectiveStatus` — é um "truque"
  documentado no comentário do código; confirmar que a lógica de `computeNextPeriodEnd`
  (`wasSuspended` sempre usa `paidAt`, nunca a âncora antiga) realmente neutraliza qualquer valor
  artificial deixado por essas duas funções.
- `assertTenantCanWrite` está em toda mutação de `catalog-actions.ts`/`appointment-actions.ts`,
  mas NÃO em `bot-texts/bot-text-actions.ts`, `tenant/actions.ts` (tema) nem em nenhuma tela de
  WhatsApp (ainda não existe) — decidir se "painel só-leitura quando SUSPENDED" deveria cobrir
  esses módulos também (a leitura desses dois é de baixo risco/edição pouco frequente, mas ficou
  de fora por escopo, não por esquecimento não registrado).
- `src/lib/email/mailer.ts`: confirmar que nenhum log inclui `to` (e-mail é dado pessoal, §11) —
  só `subject` e mensagem de erro do transporte.
- `src/modules/signup/service.ts` (`inviteTeamMember`): usuário convidado nasce com
  `passwordHash` aleatório/inutilizável até aceitar o convite — confirmar que não há caminho de
  login (`verifyCredentials`) que aceite essa senha por acidente antes do `acceptInvite` trocá-la.
- Migration `20260928000005_billing_email_idempotency` (3 colunas nullable, sem dado sensível) —
  aplicada em `innochat` e `innochat_test`; `DOWN.sql` presente.

### PENDÊNCIAS (Fase 7)

- **Sem credenciais reais do Mercado Pago** (access token + webhook secret) — todo o adaptador
  foi testado com `createMockMercadoPagoGateway()`; falta um teste ponta a ponta contra a API de
  sandbox do MP antes de ligar em produção.
- **Preços dos planos ainda em `priceCents: 0`, `active: false`** (decisão do dono, já registrada
  por Cronos) — falta o dono decidir os valores; a tela de admin de planos (Lyra) precisa
  expor isso com destaque.
- **`TrialClaim` (anti-abuso de trial por número de WhatsApp, §7.3 regra 4) não foi ligado** —
  depende da Fase 3 (conexão de instância) existir; quem implementar a Fase 3 deve chamar uma
  checagem de `TrialClaim.phoneE164` antes de permitir conectar o primeiro número em trial.
- `isTenantBotAllowedFor` está pronta e exportada (`src/modules/billing/service.ts`) mas
  `src/modules/bot-api/subscription-gate.ts` continua com o stub `true` fixo — o Atlas liga isso
  quando integrar as duas frentes.

## Configuração pela plataforma (sem URL/credencial em env var)

Decisão do dono (2026-09-28): nenhuma URL ou credencial solta em env var/chat. No Easypanel só
sobram `DATABASE_URL` e `AUTH_SECRET`; o domínio público é só a aba Domínios do Easypanel. Tudo
o mais — Evolution, n8n, Mercado Pago, SMTP, e a própria URL pública do painel — mora em
`PlatformSettings` (banco), configurado pelo admin da plataforma.

### URL pública do painel (`src/lib/public-url.ts`)

`AUTH_URL`/`NEXT_PUBLIC_APP_URL` (`src/env.ts`) ficaram **opcionais** e não são mais lidas em
runtime por nenhum código (link de e-mail, `billingUrlFor`, URL do painel enviada ao n8n).

`getPublicBaseUrl(): Promise<string>`:
1. Deriva de `x-forwarded-proto`/`x-forwarded-host` (fallback `host`) da requisição atual —
   sempre correta dentro de uma Server Action/Route Handler/RSC (mesma base do `trustHost` do
   Auth.js).
2. Fora de uma requisição (ex.: um job chamado direto, sem passar pelo handler HTTP), cai para
   `PlatformSettings.publicBaseUrl` — um espelho gravado sozinho, sem intervenção manual, na
   primeira vez que um admin salva Configurações (`ensurePublicBaseUrlFromCurrentRequest`,
   chamada de dentro de `updatePlatformSettingsAction`). Nunca sobrescreve um valor já gravado.
3. Sem nenhuma das duas (nunca aconteceu um `updatePlatformSettingsAction`, e a chamada atual
   não tem requisição — ex.: `billing/tick` rodando antes do primeiro save do admin) → lança
   `DomainError("PUBLIC_URL_UNKNOWN", ...)`. Use `tryGetPublicBaseUrl()` (nunca lança, devolve
   `null`) em caminhos que já têm um fallback de UI aceitável.

### Instalação única do primeiro admin (`src/modules/platform/install.ts`, `install-actions.ts`)

- `src/instrumentation.ts` roda `bootstrapInstallCodeIfNeeded()` no boot do servidor (runtime
  `nodejs` só — instrumentação também dispara no Edge, sem Prisma). Enquanto **não existir**
  nenhum `User.isPlatformAdmin`, gera um código novo a cada boot (`PlatformInstallCode`, hash
  SHA-256 + expiração de 24h) e imprime em texto puro, uma vez, direto em `console.log`:
  `InnoChat: código de instalação = <código> (válido por 24h, use em /instalacao)`. Nenhum outro
  lugar do sistema mostra esse valor. Se já houver admin, não faz nada (nem loga).
- `hasPlatformAdminAction(): Result<{ installed: boolean }>` — pública.
- `installPlatformAdminAction(input): Result<{ userId: string }>` — pública, mas só funciona
  enquanto não houver admin (reconfere dentro de uma transação, junto com o consumo do código —
  duas instalações concorrentes nunca criam dois admins). `input: { code, name, email,
  password }` (`name` só para UX, não persistido — `User` não tem campo de nome, mesma lacuna já
  existente em `signUpAction`/`ownerName`). Rate limit de 10/15min por IP. Erros:
  `INSTALL_CODE_INVALID`, `ALREADY_INSTALLED`, `EMAIL_TAKEN`, `RATE_LIMITED`, `INVALID_PAYLOAD`.
- `/instalacao` (rota pública): responde **404** (`notFound()`) se já houver admin — nunca
  redireciona.

### Testar conexão (`src/modules/platform/connection-tests.ts`, `actions.ts`) — Fase 1

Todas restritas a `requirePlatformAdmin()`, timeout de 5s, resultado sempre
`{ ok: boolean; detalhe: string }` — nunca o segredo de volta (nem no `detalhe`, nem em log).

- `testEvolutionConnectionAction({ evolutionApiUrl, evolutionApiKey })` — `GET
  /instance/fetchInstances` com header `apikey`.
- `testMercadoPagoConnectionAction({ mercadoPagoAccessToken })` — `GET
  https://api.mercadopago.com/users/me` com `Authorization: Bearer`.
- `testN8nConnectionAction({ n8nBaseUrl, n8nApiKey })` — `GET /api/v1/workflows?limit=1` com
  header `X-N8N-API-KEY`.
- `testSmtpConnectionAction({ smtpHost, smtpPort, smtpSecure?, smtpUser?, smtpPassword? })` —
  `transporter.verify()` (nodemailer).

Os quatro aceitam os valores que a tela ainda não salvou (testar antes de gravar) — não leem
`PlatformSettings`.

### Sincronização do n8n (`src/modules/platform/n8n-sync.ts`, `n8n-client.ts`) — Fase 5+

Superfície confirmada pelo Atlas contra o spec oficial (repo `n8n-io/n8n`, branch `master`,
`packages/cli/src/public-api/v1/handlers/**/spec`, consultado em 2026-09-28) — substitui o
levantamento anterior por conhecimento treinado, não mais confiável sem essa fonte:

- **Ativar/desativar**: `POST /workflows/{id}/activate`/`.../deactivate` estão **deprecated**;
  o substituto é `POST /workflows/{id}/publish`/`.../unpublish`. `n8n-client.ts` tenta
  publish/unpublish primeiro e só cai para activate/deactivate em 404 (instância antiga sem as
  rotas novas) — testado com mock nos dois caminhos.
- **Credenciais**: a versão atual do spec tem `GET /credentials`, `GET /credentials/{id}` e
  `PATCH /credentials/{id}` (update) além de `POST`/`DELETE`. `rotateCredential`
  (`n8n-sync.ts`) tenta `PATCH` primeiro (mantém o mesmo id); se a instância responder 404/405
  (rota/método não suportado — versão antiga), cai para "deletar o id antigo + criar um novo",
  que funciona em qualquer versão. Os dois caminhos são idempotentes.
- **`PUT /workflows/{id}`**: exige só `name`, `nodes`, `connections`, `settings` — `id`,
  `active`, `createdAt`, `updatedAt`, `isArchived`, `versionId`, `triggerCount`, `tags` e `meta`
  são `readOnly`; `n8n-client.ts#updateWorkflow` filtra para esses 4 campos antes de enviar,
  nunca reenvia o objeto cru do `GET`. `publishIfActive` (padrão `true`) fica no padrão.

Ainda **PENDÊNCIA para o Órion/dono**: esta sessão não tem acesso à internet para bater o pé em
uma instância real — o Atlas leu o spec do repositório, não testou contra um n8n rodando.
Confirmar contra `https://<n8n>/api/v1/docs` (Swagger da própria instância) na primeira
sincronização real, e conferir a versão do n8n do dono para saber se ela já tem
publish/unpublish e PATCH de credencial ou vai cair nos fallbacks.

- `syncN8nAction(): Result<N8nSyncSummary>` — exige `n8nBaseUrl`/`n8nApiKey` e
  `evolutionApiUrl`/`evolutionApiKey` já salvos em `PlatformSettings` (senão
  `N8N_NOT_CONFIGURED`/`EVOLUTION_NOT_CONFIGURED`). Passos, todos idempotentes:
  1. Resolve `painelUrl = ${getPublicBaseUrl()}/api/internal/v1`.
  2. Gera um novo segredo da API interna (`regenerateInternalApiSecret`) — o valor em texto
     puro só existe neste instante; nunca é devolvido pela action, só enviado ao n8n.
  3. Atualiza (ou recria, no fallback acima) as 3 credenciais `httpHeaderAuth`: `InnoChat
     Painel (Bearer)` (`Authorization: Bearer <segredo>`), `Evolution API (apikey)` (`apikey:
     <evolutionApiKey>`), `n8n API (X-N8N-API-KEY)` (`X-N8N-API-KEY: <n8nApiKey>`); os ids
     ficam em `PlatformSettings.n8nCred*Id`.
  4. Acha o workflow `innochat-bot` (por id salvo, senão o id de fábrica do
     `n8n/README.md`, senão por nome — `resolveWorkflow`), atualiza o nó `Config`
     (`painelUrl`, `evolutionUrl`) e reata a credencial certa em todo nó HTTP Request com
     `genericAuthType: "httpHeaderAuth"` (classificado pela URL: contém `evolutionUrl` →
     Evolution, `n8nApiUrl` → n8n, senão → Painel). `PUT /workflows/{id}` com o objeto
     filtrado (`name`, `nodes`, `connections`, `settings`).
  5. Mesma coisa para `innochat-erros` (nó `Config erros`, campo `n8nApiUrl`).
  6. **Nunca ativa** nenhum dos dois — grava só os ids em `PlatformSettings`.
  Erros: `N8N_NOT_CONFIGURED`, `EVOLUTION_NOT_CONFIGURED`, `N8N_WORKFLOW_NOT_FOUND`, `FORBIDDEN`.
- `activateBotWorkflowAction()`/`deactivateBotWorkflowAction(): Result<{ activated: boolean }>`
  — ação separada, de propósito (item 4c do pedido do dono); tenta publish/unpublish e cai para
  activate/deactivate em instância antiga. Erro `N8N_NOT_SYNCED` se `syncN8nAction` nunca rodou
  (sem id de workflow salvo).

### Troca de plano pela empresa (`src/modules/billing/actions.ts`, `service.ts#changePlan`) — §7.2

- `listActivePlansAction(tenantSlug): Result<PlanListItem[]>` — qualquer membro (`OWNER`/`STAFF`)
  pode ver os planos disponíveis (`Plan.active`, ordenados por `sortOrder`).
- `changePlanAction(tenantSlug, { planId }): Result<{ appliedImmediately: boolean }>` — restrito
  a `OWNER`. Sem `assertTenantCanWrite`: funciona mesmo com a assinatura `SUSPENDED` (é o
  caminho para saír de lá).
  - **Upgrade** (`sortOrder` novo ≥ atual): aplica na hora (`planId` trocado já, `Subscription`
    atual) — `appliedImmediately: true`. A diferença de preço só aparece na próxima fatura, sem
    cálculo proporcional (decisão do dono, §7.2).
  - **Downgrade**: só aceito se o uso ATUAL já couber no plano novo, considerando os overrides
    da empresa (`Tenant.max*Override`, que continuam valendo depois da troca) —
    `PLAN_DOWNGRADE_BLOCKED` com `{ rule: "maxProfessionals" | "maxWhatsappNumbers", limit,
    current }` se não couber (a tela usa isso para dizer o que remover). Se couber, grava
    `Subscription.pendingPlanId` — `appliedImmediately: false`.
  - `pendingPlanId` entra em vigor quando `billing/tick` gera a fatura do próximo ciclo (5 dias
    antes de começar, `generateUpcomingInvoices`): a fatura já sai no preço do plano novo E
    `Subscription.planId` já troca ali (não espera o pagamento) — é o ciclo em que o downgrade
    "vale". `applyInvoicePayment` tem o mesmo swap como rede de segurança para o caso raro de um
    pagamento confirmado antes de o tick rodar.
  - Erros: `NOT_FOUND` (assinatura/plano/empresa), `INVALID_STATE` (assinatura `CANCELED`, ou já
    está neste plano), `PLAN_DOWNGRADE_BLOCKED`, `FORBIDDEN`, `INVALID_PAYLOAD`.

### Migration

`20260928000007_platform_public_url_install_n8n` — `PlatformSettings.publicBaseUrl`/
`n8nBaseUrl`/`n8nApiKey`/`n8nCredPainelId`/`n8nCredEvolutionId`/`n8nCredApiId`/
`n8nWorkflowBotId`/`n8nWorkflowErrosId` (todas nullable) + tabela nova `PlatformInstallCode`.

## Segurança — correções pós-revisão (`docs/seguranca/revisao-2026-09-28.md`)

Vega implementou os 2 achados ALTA e os 5 MÉDIA/BAIXA priorizados pelo Atlas depois da revisão do
Órion de 2026-09-28 (veredito "LIBERADO COM RESSALVAS"). Contrato de cada correção, para Lyra/Íris/
Órion:

### Rate limit de login (`src/modules/auth/service.ts#verifyCredentials`)

Dois tetos independentes, checados ANTES de tocar o banco/bcrypt:
- por IP (`login:ip:<ip>`): 20 tentativas / 5 min.
- por e-mail normalizado (`login:email:<email>`): 8 tentativas / 15 min.

Excedendo qualquer um dos dois, `verifyCredentials` devolve `null` — EXATAMENTE o mesmo retorno
de "credencial inválida" (nenhum código/mensagem novo chega ao client; o Auth.js já trata
`authorize() → null` como erro genérico de login). Não há novo estado para a Lyra tratar na tela
de login — o comportamento observável do formulário não muda, só passa a haver um teto. IP vem
de `src/lib/http/client-ip.ts` (extraído nesta rodada — antes duplicado em `signup/actions.ts` e
`platform/install-actions.ts`, agora usado também por `src/lib/auth.ts#authorize()`).

### Cabeçalhos de segurança + CSP (`next.config.ts`)

`headers()` global (`source: "/(.*)"`, sem `middleware.ts`/`proxy.ts` — Next 16 renomeou para
`proxy.ts`, mas não foi necessário para isto): `Content-Security-Policy`, `X-Frame-Options: DENY`,
`Strict-Transport-Security` (2 anos + subdomínios), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` enxuto (nega
camera/microphone/geolocation/payment/usb, nenhum usado pelo painel).

CSP SEM nonce (decisão registrada no comentário de `next.config.ts`): `script-src`/`style-src`
usam `'unsafe-inline'` — a alternativa com nonce exige TODA página dinamicamente renderizada, e
o padrão "Without Nonces" é o que a doc da versão instalada do Next recomenda para quem não usa
nonce. `img-src` inclui `data:` (QR do Pix/Evolution vêm em base64). Fontes via `next/font`
(self-hosted) já cabem em `font-src 'self'`. **Se a Lyra algum dia adicionar um script de
terceiro (analytics, chat widget, etc.), precisa entrar em `script-src`/`connect-src`/`img-src`
explicitamente — CSP vai bloquear silenciosamente sem isso** (erro só aparece no console do
navegador, não em log de servidor).

### Corrida no webhook do Mercado Pago (`src/modules/billing/webhook.ts`)

`ProviderEvent.create` concorrente (2 notificações quase simultâneas) agora trata a violação de
unique constraint (`P2002`, `isUniqueViolation` — extraído para `src/lib/db/prisma-errors.ts`
nesta rodada, antes duplicado em `claim.ts`/`connection.ts`) como "já existe", relendo com uma
query NOVA (nunca continuando na transação que acabou de falhar — Postgres aborta a transação
inteira após uma violação; ver comentário no código). Sem `$transaction` nesta função desde esta
rodada — a constraint única já é a fonte de atomicidade real.

### Assinatura do webhook do Mercado Pago (`src/modules/billing/mercadopago.ts`)

Conferida contra o SDK oficial em Go (`github.com/mercadopago/sdk-go/pkg/webhook`,
`ValidateSignature`) — 2 desvios corrigidos:
- `data.id` agora resolvido a partir do QUERY PARAM da notificação (`route.ts`), não do corpo
  (fallback só se a query não tiver, para notificações antigas mal formadas).
- Cada par ausente (`id`/`request-id`) é OMITIDO do manifest, nunca causa rejeição isolada.

Adicionada tolerância de 10 min no `ts` (contra replay de um header capturado) —
`verifyMercadoPagoSignature` aceita um `now?: Date` opcional só para teste.

### `assertTenantCanWrite` em bot-texts e tema (`src/modules/bot-texts/bot-text-actions.ts`,
`src/modules/tenant/actions.ts`)

`upsertBotTextAction`/`resetBotTextAction`/`updateTenantThemeAction` agora bloqueiam com
`TENANT_SUSPENDED` quando a empresa está `SUSPENDED`/`CANCELED` — mesmo padrão de
`catalog-actions.ts`/`appointment-actions.ts`/`whatsapp/actions.ts`. `listBotTextsAction`/
`previewBotTextAction` continuam sem o guard (são leitura).

### LGPD — retenção/anonimização (`src/modules/maintenance/tick.ts`, NOVO)

`POST /api/internal/v1/maintenance/tick` — MESMA autenticação do `billing/tick`
(`Authorization: Bearer <INTERNAL_API_SECRET>`, sem `X-InnoChat-Instance`). Chamado
periodicamente pelo `innochat-cron` (fora deste repo — **sem workflow novo no n8n**, o Atlas
pluga a chamada). Resposta 200: `{ inboundEventsPurged, contactsAnonymized }`
(`MaintenanceTickSummary`).

- Purga `InboundEvent` com `createdAt` > 30 dias (`docs/arquitetura.md` §11).
- Anonimiza `Contact` de tenants `CANCELED` há mais de 90 dias (`Subscription.canceledAt`):
  zera `name`/`pushName`/`phoneE164`/`lid`, substitui `waJid` por `anon:<contactId>` (mantém a
  linha e a integridade referencial com `Appointment` histórico). Processado em lotes de 500 por
  chamada — a próxima execução continua de onde parou.
- Idempotente: `InboundEvent` já apagado não conta de novo; `Contact` já anonimizado é
  reconhecido pelo prefixo `anon:` em `waJid` e pulado.

**Correção associada em `src/modules/billing/tick.ts#reconcileStatuses`**: `canceledAt` nunca
era persistido quando o status efetivo virava `CANCELED` por lá (só era zerado na reativação) —
sem isso, uma empresa cancelada automaticamente (60 dias em `SUSPENDED`) nunca teria data de
referência para a anonimização rodar. Agora marca `canceledAt: now` na transição.

### SSRF leve em "Testar conexão" e na sincronização do n8n (`src/lib/net/safe-fetch.ts`, NOVO)

`safeFetch`/`assertSafeExternalUrl` usados em `platform/connection-tests.ts` (Evolution, n8n —
NÃO Mercado Pago, que usa URL fixa da API oficial) e `platform/n8n-client.ts` (usado por
`n8n-sync.ts`). Bloqueia: esquema diferente de `http`/`https`; o endereço de metadados de nuvem
`169.254.169.254`; redirecionamento para um HOST diferente do original. **Não bloqueia IP
privado em geral** — decisão deliberada, Evolution/n8n reais costumam estar na mesma rede
interna do Easypanel.

### Dívida técnica (não implementada nesta rodada, por pedido explícito)

- Cifragem em repouso dos segredos de `PlatformSettings` (proposta detalhada no relatório do
  Órion: AES-256-GCM com chave derivada de `AUTH_SECRET` via HKDF).
- Rate limit distribuído (Redis/Postgres) — o rate limit de login herda a mesma limitação já
  documentada em `src/lib/rate-limit.ts` (processo único, zera em restart).
Aplicada em `innochat` e `innochat_test`; `DOWN.sql` presente.

### `resendVerificationEmailAction()` (adicionado pelo Atlas, 2026-09-28)

`src/modules/signup/actions.ts`. Usuário logado; sem entrada. Rate limit de 3 por hora por usuário (`RATE_LIMITED`).
Saída: `Result<{ alreadyVerified: boolean }>`. Se já verificado, não envia nada e devolve `alreadyVerified: true`
(a UI deve parar de oferecer o botão). Falha de SMTP só é logada, como no cadastro. Coberto em
`tests/integration/billing-signup.integration.test.ts`.
