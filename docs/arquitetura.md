# Arquitetura — InnoChat

Documento de referência da squad. O que está aqui são decisões, não sugestões, e vale até ser
mudado **aqui**. Quem discordar (Vega, Lyra, Cronos, Íris, Órion, Vulcano) leva a objeção ao
Atlas em vez de implementar diferente em silêncio.

Autora: Nova, 2026-09-28. Base: decisões fechadas com o dono (`PROGRESSO.md`) e lições do
InnoAtendente (`C:\Projetos\Web\InnoAtendente\docs\arquitetura.md`, `prisma/schema.prisma`,
`PROGRESSO.md`).

---

## 0. Contexto e hipóteses declaradas

| Item | Hipótese | Efeito na arquitetura |
|---|---|---|
| Maturidade | **MVP** de produto SaaS | Um serviço de aplicação, sem worker, sem Redis e sem fila própria |
| Escala (1º ano) | 1 a 50 empresas, até ~3 números cada, centenas de mensagens/dia por empresa | Postgres único dá conta com folga; nada de particionamento |
| Equipe | Squad de agentes + dono como operador | Menos peças móveis vence. Cada peça nova é mais uma que o dono precisa operar no Easypanel |
| Prazo | Não informado; assumido "semanas, não meses" para a v1 | Plano em fases entregáveis; lembretes, cobrança e cadastro público ficam fora da v1 |
| Infra | VPS do dono com Easypanel; Evolution API já roda lá e **é compartilhada com o InnoAtendente**; n8n do dono (controlado via MCP) | Nome de instância com prefixo próprio; o n8n é peça obrigatória do caminho da mensagem |

Se alguma hipótese estiver errada (principalmente escala acima de ~200 empresas ou prazo muito
curto), o plano da §11 muda, e a stack não.

---

## 1. Stack

### Opções avaliadas

| | **A. Next.js App Router + Prisma/Postgres + Auth.js v5 + Tailwind v4** | B. API separada (Fastify/Nest) + SPA React (Vite) | C. Low-code: n8n + NocoDB/Appsmith/Supabase Studio como painel |
|---|---|---|---|
| Prós | Mesma stack do InnoAtendente: padrões, armadilhas e Dockerfile já conhecidos. Um processo serve painel **e** API interna. Server Components e Server Actions reduzem o código de "cola" | Separação forte front/back; API reutilizável por app mobile no futuro | Mais rápido para um protótipo interno |
| Contras | Acoplamento front/back no mesmo deploy (aceitável nesta escala) | Dois deploys, dois Dockerfiles, CORS, autenticação duplicada, sem ganho real na escala prevista | Multiempresa com isolamento real, fluxo de QR, UX "clean e intuitiva" e regra de agenda transacional ficam frágeis ou impossíveis. Não atende "robusto e completamente funcional" |
| Veredito | **Recomendada** | Descartada: complexidade sem retorno | Descartada: não atende o pedido |

### Stack fechada (opção A)

- **Next.js (App Router) + TypeScript strict**: painel e API interna (`/api/internal/v1/*`) no mesmo serviço.
- **Prisma + PostgreSQL** (serviço gerenciado do Easypanel, **banco próprio**, sem compartilhar o do InnoAtendente).
- **Auth.js v5** com credenciais (e-mail + senha, bcrypt) e sessão JWT.
- **Tailwind v4** + componentes Radix/shadcn, com o padrão visual do InnoAtendente adaptado.
- **zod** nas bordas (API interna, server actions), **date-fns + date-fns-tz** para fuso (decisão já validada no InnoAtendente).
- **Vitest** para unidade e integração (Postgres real no CI) e **Playwright** para E2E do painel.
- **Sem Redis e sem worker.** O que seria assíncrono ou agendado (envio com "digitando", cron de lembretes no futuro) é papel do **n8n**. É a principal simplificação em relação ao InnoAtendente.

Deploy: **um** `Dockerfile` (serviço `innochat-painel` no Easypanel). A migration **não** roda no
boot (lição do InnoAtendente): roda como passo explícito, **antes** do push que usar coluna nova,
porque o auto-deploy por Git pode estar ligado.

---

## 2. Divisão de responsabilidades: painel, n8n e Evolution

### A decisão central: onde mora a lógica do menu

A hipótese inicial do Atlas era "n8n é o motor da conversa e chama endpoints granulares do
painel". Contesto essa parte (e só ela). Proposta: **o painel decide, o n8n orquestra.**

| | **Opção 1 (recomendada): máquina de estados no painel** | Opção 2: máquina de estados no n8n |
|---|---|---|
| Onde fica cada passo do menu | Função pura TypeScript (`core/bot`), com teste unitário para cada transição | Nós Switch/Code no n8n, um ramo por estado (~40 a 60 nós) |
| Concorrência | Uma transação: dedupe da mensagem + `SELECT … FOR UPDATE` na sessão + reserva do horário. Atômico | Várias chamadas HTTP por mensagem (lê sessão → lê horários → grava → salva sessão). Duas execuções paralelas do mesmo cliente corrompem a sessão, e é preciso trava otimista manual |
| Testes | Vitest no CI, Íris consegue reprovar | Sem CI. Testar é disparar mensagem de verdade |
| Versionamento e revisão | Git, PR, Órion revisa | JSON de workflow editado via MCP; diff ilegível |
| Textos editáveis por empresa | Naturais: vêm do banco | Precisam ser buscados do banco de qualquer jeito |
| Visibilidade para o dono | Menor: o dono não "vê" o menu desenhado no n8n | Maior: o fluxo aparece desenhado |

**Recomendação: Opção 1.** O n8n continua indispensável e no caminho de toda mensagem. Ele
recebe o webhook da Evolution, filtra, chama o painel, envia as respostas com "digitando" pela
Evolution, repassa eventos de conexão e é onde entram as automações futuras (lembretes por
Schedule, aviso ao dono de novo agendamento, planilhas, etc.). Isso respeita a decisão fechada
("um único conjunto de workflows atende todos os tenants") sem colocar regra de negócio
transacional num lugar sem teste. **Precisa de ok do dono** (§13, pendência 1).

### Quem faz o quê

| Peça | Responsável por | Nunca faz |
|---|---|---|
| **Evolution API** (já existe) | Sessão WhatsApp (Baileys), QR, envio e recebimento | Nenhuma regra de negócio |
| **n8n** (1 workflow principal + 1 de erro) | Receber o webhook de todas as instâncias, responder 200 na hora, descartar ruído (grupo, status, evento irrelevante), repassar ao painel, enviar as respostas na ordem com `delay` ("digitando"), repassar eventos de conexão | Decidir o próximo passo do menu, calcular horário, gravar agendamento, guardar estado |
| **Painel (Next.js + Postgres)** | Fonte da verdade: empresas, usuários, números, serviços, profissionais, expediente, bloqueios, contatos, agendamentos, **sessão da conversa**. Motor do menu. Cálculo de horários. Reserva atômica. Gestão de instâncias na Evolution (criar, QR, status, desconectar) | Enviar mensagem de conversa (isso é do n8n). Receber webhook direto da Evolution |

### Fluxo de uma mensagem

```
Cliente (WhatsApp)
   │
   ▼
Evolution API ── POST https://<n8n>/webhook/innochat/evolution/<webhookToken>
   │                (webhook por instância; byEvents=false)
   ▼
n8n: Webhook (responde 200 imediatamente)
   ├─ IF event ∉ {messages.upsert, connection.update} → fim
   ├─ HTTP POST painel /api/internal/v1/evolution/events   (Bearer + webhookToken + corpo bruto)
   │     ▼
   │   Painel, em UMA transação:
   │     1. autentica o segredo da plataforma; resolve instância e tenant pelo webhookToken + instance
   │     2. normaliza (texto, remetente, @lid, fromMe, idade da mensagem)
   │     3. INSERT InboundEvent (instanceId, providerMessageId) → conflito = duplicata → ignora
   │     4. upsert Contact; SELECT ChatSession FOR UPDATE
   │     5. step(sessão, entrada) → próximo estado + comandos (ex.: BOOK)
   │     6. executa comandos (INSERT Appointment; 23P01 → SLOT_TAKEN tratado pelo próprio step)
   │     7. grava sessão e responde { action, to, messages[] }
   │     ▼
   ├─ IF action = "reply" → para cada mensagem, em ordem:
   │      HTTP POST Evolution /message/sendText/{instance}  { number: to, text, delay }
   └─ fim
```

O painel **não** chama a Evolution para mensagens de conversa, e o n8n **não** decide nada. Uma
execução do n8n custa 1 chamada ao painel + N envios.

### Estado da conversa: tabela `ChatSession` no Postgres

| Opção | Por que sim | Por que não |
|---|---|---|
| **Tabela no Postgres, dentro do painel (escolhida)** | Mesma transação que reserva o horário: sessão e agendamento nunca divergem. `FOR UPDATE` serializa mensagens do mesmo cliente. Entra no backup e nas migrations. O painel mostra quem está em atendimento humano | Nenhum relevante nesta escala |
| n8n Data Table | Visível no n8n | Sem transação e sem lock de linha, sem FK para tenant/contato, fora do backup do produto, e duas execuções paralelas pisam uma na outra |
| Redis | Rápido e com TTL nativo | Peça nova para operar; o estado precisa ser transacional com o agendamento, e TTL resolve-se com `expiresAt` |

### Regras de robustez (valem para Vega e para o workflow do n8n)

1. **Idempotência.** Três camadas: (a) o n8n responde 200 na hora, então a Evolution raramente
   reentrega; (b) o nó HTTP do n8n tem retry (3×, backoff), então o painel precisa ser idempotente;
   (c) `InboundEvent` tem unique `(whatsappInstanceId, providerMessageId)`. Duplicata responde
   `{"action":"ignore","reason":"DUPLICATE"}`. Semântica **no máximo uma vez**: se a primeira
   execução processou e o n8n caiu antes de enviar, o cliente fica sem aquela resposta e a próxima
   mensagem dele reapresenta o passo atual. Isso é aceito conscientemente, porque é melhor do que
   responder duas vezes.
2. **Concorrência de horário.** A garantia é do Postgres: constraint `EXCLUDE USING gist`
   (`btree_gist`) em `Appointment` por profissional, com intervalo semiaberto `[)`, só para status
   ativos. O Prisma não expressa isso; é **migration SQL escrita à mão** (Cronos) e o teste de
   concorrência é obrigatório. Sem "segurar" horário na v1: se o slot for ocupado entre a oferta e
   a confirmação, o bot diz "esse horário acabou de ser preenchido" e reapresenta os horários do
   mesmo dia.
3. **Concorrência de sessão.** `SELECT … FOR UPDATE` na linha da sessão. Duas mensagens rápidas do
   mesmo cliente são processadas em série, cada uma com sua resposta.
4. **Timeout de sessão.** `ChatSession.expiresAt = lastInboundAt + Tenant.sessionTimeoutMin`
   (padrão 30). Mensagem após expirar: a sessão volta ao menu principal com uma linha de aviso
   ("Vamos recomeçar"). Não há job de limpeza: a expiração é avaliada na chegada.
5. **Mensagem fora do fluxo.**
   - Comandos globais em qualquer passo: `0` ou `menu` → menu principal; `sair` → encerra a sessão.
   - Opção inválida → repete o menu atual com "Não entendi, responda com o número da opção".
     Após **3** inválidas seguidas → oferece "Falar com atendente" ou o menu principal.
   - Aceita também o **texto da opção** (sem acento, sem caixa, por prefixo único). Por exemplo,
     "corte" casa com "1. Corte feminino" quando for a única opção que começa assim.
   - Mídia (áudio, imagem, figurinha, localização) → "Por aqui eu só leio texto. Responda com o
     número da opção." e repete o menu.
   - O número digitado é sempre interpretado **contra as opções gravadas na sessão**
     (`context.options`), nunca contra o catálogo recalculado. Assim, se um serviço for editado
     no meio da conversa, o "2" continua significando o que o cliente viu.
6. **Mensagem velha.** `messageTimestamp` mais de 5 min no passado → ignora (`reason: "STALE"`).
   Isso protege contra rajada de sincronização na reconexão da instância.
7. **Atendimento humano.**
   - Opção "Falar com atendente" → sessão em `HUMAN` com `humanUntil = agora + Tenant.humanPauseMin`
     (padrão 720). O bot fica em silêncio para esse contato e o painel lista em "Atendimentos".
     O botão "Devolver ao bot" encerra antes.
   - **O dono responde pelo celular** (mensagem `fromMe` que não foi o bot): o bot pausa para
     aquele contato pelo mesmo período. Para distinguir o eco do bot, o painel grava na sessão o
     hash dos textos que mandou enviar nos últimos 2 min (`context.recentOutbound`) **antes** de
     devolver a resposta ao n8n. Um `fromMe` cujo texto bate com um hash recente é eco e é
     ignorado; os outros são intervenção humana. Isso não depende da ordem de chegada. **Precisa
     ser validado com servidor real na Fase 0** (se a Evolution emite `messages.upsert` com
     `fromMe` para o que o celular envia).
8. **Anti-banimento.** O bot só responde a quem escreveu. Não há disparo em massa na v1. Toda
   resposta sai com `delay` 800–1500 ms ("digitando" nativo da Evolution) e no máximo 3 mensagens
   por turno.

---

## 3. Menu no WhatsApp: formato

### Estado atual dos botões e listas (pesquisa em 2026-09-28)

- A documentação do cliente R da Evolution API v2 afirma que **botões e listas interativas "não são
  suportados no conector Baileys e provavelmente serão descontinuados"**, que funcionam só no
  conector Cloud API (oficial da Meta) e sugere enquete (*poll*) como alternativa.
  [strategicprojects.github.io/evolution](https://strategicprojects.github.io/evolution/)
- **Regressões recorrentes:** `sendList` enviava mas **não chegava ao contato**, sem erro, a partir
  do Baileys 6.7.18 (v2.2.3/v2.3.0, jun/2025).
  [issue #1620](https://github.com/EvolutionAPI/evolution-api/issues/1620). Botões e listas
  quebraram com HTTP 400 na v2.3.7 (jan/2026), e a issue foi fechada como *not planned*.
  [issue #2390](https://github.com/evolution-foundation/evolution-api/issues/2390)
- O Baileys oficial (WhiskeySockets) **não suporta mais** botões e listas. O que existe são forks
  comunitários que simulam `nativeFlow`.
  [npm/GitHub baileys-buttons e forks](https://github.com/meowguck-art/baileys-buttons)
- **Enquete também não serve:** o voto chega como `messages.update` **sem** a opção escolhida
  (v2.3.0, issue aberta). [issue #1644](https://github.com/evolution-foundation/evolution-api/issues/1644)

### Decisão

**Lista numerada em texto puro, sempre.** Nada de interativo na v1. O motor gera texto; se um dia
o canal for a Cloud API oficial, basta um renderizador de "interativo" na saída, porque o motor
já trabalha com opções estruturadas (`{n, id, label}`), não com texto solto.

Exemplo:

```
Olá, Maria! Sou o assistente virtual do *Studio Bela*.
Responda com o número:

1. Agendar horário
2. Meus agendamentos
3. Falar com atendente
```

Regras de texto: no máximo **9 opções por menu** (1–9). Havendo mais, entra `9. Ver mais`.
`0` = menu principal, sempre no rodapé. Datas e horas formatadas com `Intl` no fuso do tenant
("Ter 30/09", "14:30"). Negrito com `*…*` só no nome da empresa e no resumo de confirmação.

### Máquina de estados (v1)

```
MAIN_MENU ──1──► SELECT_SERVICE ──► SELECT_PROFESSIONAL* ──► SELECT_DAY ──► SELECT_TIME
    │                                                                         │
    │                                                     ASK_NAME** ◄────────┘
    │                                                         │
    │                                                     CONFIRM ──1──► [BOOK] ──► MAIN_MENU (com resumo)
    │                                                         └──2──► SELECT_TIME
    ├──2──► MY_APPOINTMENTS ──► APPOINTMENT_ACTION ──1 Cancelar──► CONFIRM_CANCEL ──► [CANCEL]
    │                                             └──2 Remarcar──► SELECT_DAY (mode=RESCHEDULE) … CONFIRM ──► [RESCHEDULE]
    └──3──► HUMAN  (silêncio até humanUntil ou "Devolver ao bot")
```

\* `SELECT_PROFESSIONAL` é pulado se o serviço tem 1 profissional ou se `Tenant.askProfessional = false`.
Quando aparece, inclui "Qualquer profissional" (o sistema escolhe, na hora de reservar, o primeiro
livre no horário).
\*\* `ASK_NAME` só aparece se o contato ainda não tem `name` confirmado (o `pushName` é sugestão,
não verdade). É o único passo de texto livre, com 2 a 60 caracteres.

- `SELECT_DAY`: próximos 7 dias **com vaga** dentro de `maxHorizonDays`, mais `8. Ver mais datas`.
- `SELECT_TIME`: até 8 horários do dia, mais `9. Mais horários`.
- Cancelar ou remarcar respeita `Tenant.cancelMinLeadMin` (padrão 120). Dentro do prazo, o bot
  oferece "Falar com atendente".
- Remarcar é **um UPDATE** no mesmo `Appointment` (a constraint aceita, já que a linha não
  conflita consigo mesma), com `AppointmentEvent(RESCHEDULED)`.

---

## 4. Conexão do WhatsApp (QR code) e vários números

### Vários números por empresa: sim, na v1

"Números" veio no plural e o custo de modelar N:1 agora é quase zero. Trocar 1:1 por N:1 depois
seria migration e retrabalho de UI.

- `WhatsappInstance.tenantId` **não** é único. Limite por empresa: `Tenant.maxWhatsappNumbers`
  (padrão **1**), editável só pelo admin da plataforma. Isso controla o risco de banimento e a
  carga na Evolution compartilhada.
- Na v1, **todos os números de uma empresa atendem a mesma agenda e o mesmo catálogo**. Número por
  unidade ou por profissional fica para depois (a coluna `label` já permite "Unidade Centro").
- `Contact` é por **empresa** (a mesma cliente escrevendo em dois números é uma pessoa só).
  `ChatSession` é por **(número, contato)**, porque cada chat tem sua conversa.
- `Appointment.whatsappInstanceId` registra por qual número foi marcado (serve para lembretes
  saírem do mesmo número no futuro).

### Nome da instância

`innochat-<tenantSlug até 20 chars>-<4 chars aleatórios>`, por exemplo `innochat-studio-bela-x7k2`.
Imutável depois de criado, porque é a chave na Evolution. O prefixo `innochat-` é **obrigatório**:
a Evolution é compartilhada com o InnoAtendente, e colisão de nome derrubaria o número de outro
produto.

### Fluxo

```
Painel › WhatsApp › "Conectar número"   (bloqueado se atingiu maxWhatsappNumbers)
 1. Server action createInstance(label)
    ├─ gera instanceName e webhookToken (32 bytes, base64url)
    ├─ POST {evo}/instance/create  { instanceName, integration:"WHATSAPP-BAILEYS", qrcode:true,
    │                                 groupsIgnore:true, readMessages:false, alwaysOnline:false }
    ├─ POST {evo}/webhook/set/{instanceName}   ← sempre explícito, não confiar no bloco embutido no create
    │     { webhook: { enabled:true, url:"<n8nWebhookBaseUrl>/<webhookToken>", byEvents:false,
    │                  base64:false, events:["MESSAGES_UPSERT","CONNECTION_UPDATE"] } }
    └─ grava WhatsappInstance(status=QRCODE)
 2. Modal de QR: o cliente consulta GET /api/whatsapp/instances/{id}/state a cada 3 s
    ├─ servidor: GET {evo}/instance/connectionState/{name}
    ├─ se não "open" e o QR guardado tem mais de 25 s: GET {evo}/instance/connect/{name} → QR (data URL)
    └─ devolve { status, qrCode?, phoneE164? }
    A consulta para em CONNECTED ou após 2 min ("QR expirou — gerar novo").
 3. "open" → busca o número (fetchInstances → ownerJid), grava CONNECTED + phoneE164 + lastConnectedAt
 4. Desconectar: DELETE {evo}/instance/logout/{name} → DISCONNECTED (a instância fica; reconectar = passo 2)
 5. Remover número: DELETE {evo}/instance/delete/{name} → soft delete (deletedAt)
 6. Queda inesperada: connection.update chega via n8n → /events → status DISCONNECTED
    → banner no painel "Número X desconectado — reconectar".
```

A consulta periódica garante a tela do QR; o evento de conexão garante o status quando ninguém
está olhando. Os dois caminhos gravam no mesmo campo.

**Reaplicar webhooks:** se `PlatformSettings.n8nWebhookBaseUrl` mudar, o admin da plataforma tem
o botão "Reaplicar webhook em todas as instâncias", que chama `webhook/set` para cada uma.

Os endpoints da Evolution acima seguem a API v2 pública e o que o InnoAtendente usou contra o
servidor do dono em 2026-09-04. **Confirmar na Fase 0** a versão exata do servidor, porque
houve regressões entre 2.2.x e 2.3.x.

---

## 5. Modelo de dados (alto nível — o Cronos detalha)

Banco único, schema único, `tenantId` em toda tabela de negócio. O acesso passa por um cliente
com escopo (`forTenant(tenantId)`, Prisma Client Extension), e o Prisma cru só é usado em
`src/lib/db/` (regra de lint), como no InnoAtendente. **O `tenantId` nunca vem da requisição:**
vem da sessão (painel) ou da instância resolvida pelo `webhookToken` (API interna).

### Plataforma e identidade
- **PlatformSettings** (singleton `id="default"`): `evolutionApiUrl`, `evolutionApiKey`
  (sensível, **sempre mascarada** na UI, com os 4 últimos caracteres), `n8nWebhookBaseUrl`,
  `internalApiSecretHash` (hash do segredo usado pelo n8n, mostrado **uma vez** ao gerar),
  `updatedByUserId`.
- **User** (global): e-mail único, `passwordHash`, `isPlatformAdmin` (ortogonal a qualquer tenant).
- **Tenant**: `slug`, `name`, `timezone` (padrão `America/Sao_Paulo`), `status`
  (`ACTIVE|SUSPENDED`), configurações em colunas escalares: `slotGranularityMin` (15),
  `minLeadTimeMin` (60), `maxHorizonDays` (30), `cancelMinLeadMin` (120), `sessionTimeoutMin` (30),
  `humanPauseMin` (720), `askProfessional` (true), `maxWhatsappNumbers` (1).
- **Membership**: `userId × tenantId × role` (`OWNER | STAFF`).
- **BotText**: `tenantId`, `key` (enum fechado: `GREETING`, `BOOKED`, `CANCELED`, `HUMAN_HANDOFF`,
  `OUT_OF_HOURS_NOTE`…), `text` com variáveis `{nome}`, `{empresa}`, `{servico}`, `{data}`,
  `{hora}`, `{profissional}`. Sem linha = texto padrão do código.

### Catálogo e agenda
- **Service**: `name`, `durationMin`, `bufferAfterMin` (0), `priceCents?` (opcional, exibido no
  menu se preenchido), `active`, `sortOrder`.
- **Professional**: `name`, `active`, `sortOrder`.
- **ProfessionalService**: N:N (quem faz o quê).
- **WorkingHour**: `professionalId`, `dayOfWeek`, `startTime`/`endTime` em **hora local** `HH:mm`,
  com várias faixas por dia (almoço no meio).
- **ScheduleException**: `BLOCK | HOLIDAY`, intervalo de instantes, escopo empresa
  (`professionalId` nulo) ou profissional, `reason`.

### Clientes, agendamentos e conversa
- **Contact**: único por `(tenantId, waJid)`. `waJid` = JID canônico usado para responder (§6.3).
  Também `phoneE164?` (só exibição e busca), `lid?`, `name?`, `pushName?`, `botPausedUntil?`
  (pausa pelo painel, independente da sessão).
- **Appointment**: `contactId`, `serviceId`, `professionalId`, `whatsappInstanceId?`,
  `startsAt`/`endsAt` (o que o cliente vê), `blockEndsAt` (= `endsAt + bufferAfterMin`, usado pela
  constraint), `status` (`SCHEDULED | CANCELED | COMPLETED | NO_SHOW`), `source`
  (`WHATSAPP | PANEL`), `notes?`. **Constraint `EXCLUDE`** por `professionalId` sobre
  `tstzrange(startsAt, blockEndsAt, '[)')` onde `status = 'SCHEDULED'`, em migration SQL à mão.
- **AppointmentEvent**: trilha imutável (`CREATED | RESCHEDULED | CANCELED | COMPLETED | NO_SHOW`),
  com autor (`CONTACT | USER | SYSTEM`) e payload.
- **WhatsappInstance**: `tenantId` (N por tenant), `instanceName` (único global), `label`,
  `status` (`QRCODE | CONNECTING | CONNECTED | DISCONNECTED`), `phoneE164?`, `webhookToken`
  (único), `lastConnectedAt?`, `deletedAt?`.
- **ChatSession**: único `(whatsappInstanceId, contactId)`. `state` (enum da §3), `context`
  (jsonb: escolhas feitas, `options` do último menu, `mode`, `appointmentId` em remarcação,
  `recentOutbound`), `invalidCount`, `lastInboundAt`, `expiresAt`, `humanUntil?`.
- **InboundEvent**: único `(whatsappInstanceId, providerMessageId)`, `receivedAt`, `outcome`
  (`REPLIED | IGNORED | DUPLICATE | ERROR`), `reason?`, `stateBefore?`/`stateAfter?`. **Sem
  conteúdo da mensagem** (LGPD). Serve para idempotência e diagnóstico. Purga após 30 dias.

**Sem transcrição de conversa na v1** (minimização de dados; o histórico completo está no celular
da empresa). O diagnóstico usa `InboundEvent`. Pendência para o dono (§13).

```
User ──< Membership >── Tenant ──< Professional ──< WorkingHour
                          │            └──< ProfessionalService >── Service
                          ├──< ScheduleException
                          ├──< WhatsappInstance ──< ChatSession >── Contact
                          │           └──< InboundEvent
                          ├──< Contact ──< Appointment >── Service / Professional
                          │                    └──< AppointmentEvent
                          └──< BotText
PlatformSettings (singleton)
```

### Cálculo de horários (função pura em `core/agenda`)
```
slots(serviço, profissional?, dia)
  = faixas de WorkingHour do dia (hora local → instante com o fuso do tenant)
  − ScheduleException (empresa e profissional)
  − Appointment SCHEDULED [startsAt, blockEndsAt)
  − antes de agora + minLeadTimeMin;  ∩ até hoje + maxHorizonDays
  passo = slotGranularityMin; o slot cabe se [início, início + duração + buffer) está livre
```
O mesmo `AgendaService.book()` atende o bot e o painel: uma regra, dois consumidores.

---

## 6. Contratos

### 6.1 Autenticação da API interna (n8n → painel)

- Base: `https://<painel>/api/internal/v1`
- Header `Authorization: Bearer <INTERNAL_API_SECRET>`. O segredo é gerado na tela de admin da
  plataforma, mostrado uma vez e guardado como **hash** (SHA-256) em `PlatformSettings`. No n8n,
  fica como credencial *Header Auth*. A comparação é em tempo constante.
- **Escopo por instância:** toda chamada leva `webhookToken` + `instance` (nome). O painel resolve
  `WhatsappInstance` por `webhookToken` e **exige** que o `instanceName` bata. Sem match, a
  resposta é 404 genérico. O `tenantId` nunca é aceito no corpo.
- Erros: `401 UNAUTHORIZED` (segredo inválido), `404 INSTANCE_NOT_FOUND`, `422 INVALID_PAYLOAD`,
  `500 INTERNAL`. Formato: `{ "error": { "code": "…", "message": "…" } }`. Timeout do lado do n8n:
  10 s; retry 3× só em 5xx e timeout (o painel é idempotente).

### 6.2 `POST /api/internal/v1/evolution/events`

Um endpoint só para todo evento vindo da Evolution. O n8n **não normaliza nada**: repassa o corpo
bruto, e o painel é quem conhece o formato da Evolution (e tem teste com fixtures reais).

Request:
```json
{
  "webhookToken": "Zq3…(do path do webhook)",
  "payload": { "event": "messages.upsert", "instance": "innochat-studio-bela-x7k2", "data": { } }
}
```

Response 200 — responder:
```json
{
  "action": "reply",
  "instance": "innochat-studio-bela-x7k2",
  "to": "5511999999999",
  "messages": [
    { "text": "Perfeito! Escolha o dia:\n\n1. Ter 30/09\n2. Qua 01/10\n…\n\n0. Menu principal", "delayMs": 1200 }
  ]
}
```

Response 200 — nada a fazer (o n8n encerra sem enviar):
```json
{ "action": "ignore", "reason": "DUPLICATE" }
```
`reason` ∈ `DUPLICATE | STALE | FROM_ME_ECHO | HUMAN_MODE | BOT_PAUSED | GROUP | UNSUPPORTED_EVENT | CONNECTION_UPDATED | TENANT_SUSPENDED | UNRESOLVABLE_SENDER`.

Garantias do painel: `messages` tem de 1 a 3 itens, `text` ≤ 4000 caracteres, e `to` já está no
formato que a Evolution aceita em `sendText` (§6.3). Evento irreconhecível **nunca** gera 5xx:
vira `ignore` (para não entrar em laço de retry).

### 6.3 Remetente, `@lid` e para onde responder — atenção

O WhatsApp está migrando para identificadores **LID** (`NNNN@lid`) no lugar do número
(`55…@s.whatsapp.net`). Na Evolution isso quebrou respostas em integrações com n8n, e **responder
para um `@lid` devolve 400 `exists: false`** em várias versões. O rastreio está aberto desde 2025 e
foi reorganizado em abr/2026.
[issue #1872](https://github.com/evolution-foundation/evolution-api/issues/1872),
[issue #2326](https://github.com/EvolutionAPI/evolution-api/issues/2326)

Regra de normalização (Vega, no adaptador; testada com fixtures da Fase 0):
1. `remoteJid` termina em `@s.whatsapp.net` → é o `waJid` canônico.
2. `remoteJid` termina em `@lid` → usar `remoteJidAlt` (ou `senderPn`, conforme a versão) como
   `waJid` e guardar o LID em `Contact.lid`. Sem campo alternativo → procurar `Contact` pelo `lid`
   já conhecido; sem nada → `ignore` com `UNRESOLVABLE_SENDER` (registrado para métrica).
3. `@g.us` (grupo), `status@broadcast` e newsletter → `ignore`.
4. **Responder sempre para os dígitos do `waJid` exatamente como vieram.** O `phoneE164` com a
   reconstituição do 9º dígito brasileiro (lição do InnoAtendente, 2026-09-05) serve **só para
   exibição e busca**, nunca como destino de envio.

### 6.4 Webhook Evolution → n8n

- URL por instância: `<n8nWebhookBaseUrl>/<webhookToken>`, por exemplo
  `https://n8n.dominio/webhook/innochat/evolution/<webhookToken>` (nó Webhook do n8n com path
  `innochat/evolution/:token`, método POST, **resposta imediata 200**).
- Configuração: `byEvents: false`, `base64: false`,
  `events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]`.
- Corpo esperado (formato v2, **a confirmar com captura real na Fase 0**):
```json
{
  "event": "messages.upsert",
  "instance": "innochat-studio-bela-x7k2",
  "data": {
    "key": { "remoteJid": "5511999999999@s.whatsapp.net", "remoteJidAlt": "…opcional…", "fromMe": false, "id": "3EB0A1B2C3D4" },
    "pushName": "Maria",
    "message": { "conversation": "2" },
    "messageType": "conversation",
    "messageTimestamp": 1759080000
  },
  "date_time": "2026-09-28T14:00:00.000Z",
  "server_url": "…",
  "apikey": "…"
}
```
  O texto pode vir em `message.conversation` ou `message.extendedTextMessage.text`, e o painel
  trata os dois.
- `connection.update`: `data.state ∈ open | connecting | close`, `data.wuid?`.

### 6.5 Envio (n8n → Evolution)

`POST {evolutionApiUrl}/message/sendText/{instance}` com header `apikey`, corpo
`{ "number": "<to>", "text": "<text>", "delay": <delayMs> }`. O `delay` faz a Evolution mostrar
"digitando" antes de enviar. As mensagens saem **em sequência**, nunca em paralelo. A chave da
Evolution fica como **credencial do n8n** (pendência 5 da §13). Falha de envio vai para o workflow
de erro do n8n (log). A desconexão chega ao painel pelo `connection.update`.

### 6.6 Workflow do n8n (especificação para o Atlas montar via MCP)

```
[Webhook POST innochat/evolution/:token, responde 200 imediato]
  → [IF body.event ∈ {messages.upsert, connection.update}]      (senão: fim)
  → [HTTP POST painel /evolution/events  (Header Auth, timeout 10s, retry 3x)]
  → [IF action == "reply"]                                        (senão: fim)
  → [Split Out messages] → [HTTP POST Evolution sendText (em lote de 1, sequencial)]
Workflow de erro: registra a execução com falha (sem conteúdo de mensagem).
```
Configuração obrigatória no n8n: **não salvar dados de execuções bem-sucedidas** (ou prune curto),
porque elas contêm telefone e texto do cliente final (LGPD).

### 6.7 API do painel para o navegador (Lyra ↔ Vega)

Mutações por **Server Actions** e leituras por Server Components, todos passando pela camada de
serviço. As únicas rotas HTTP para o cliente são:
- `GET /api/whatsapp/instances/{id}/state` → `{ status, qrCode?: "data:image/png;base64,…", phoneE164? }`
  (consulta periódica do modal de QR).
- `GET /api/agenda/slots?serviceId&professionalId?&date=YYYY-MM-DD` → `{ slots: [{ startsAt, professionalId }] }`
  (formulário de agendamento manual).

Resultado das Server Actions: `Result<T> = { ok: true, data } | { ok: false, error: { code, message, fields? } }`.
`SLOT_TAKEN` é resultado esperado, não exceção. Assinaturas exatas: Vega publica em
`docs/contratos.md` na Fase 1, antes da Lyra começar as telas.

---

## 7. Telas do painel

### Empresa (`/(app)/[tenantSlug]/…`)
| Tela | Propósito |
|---|---|
| **Agenda** (início) | Dia e semana em colunas por profissional. Criar agendamento manual, ver detalhe, cancelar, marcar concluído ou falta. Filtro por profissional |
| **Agendamentos** | Lista com filtros (período, status, profissional, serviço, busca por cliente). Útil no celular, onde a grade é apertada |
| **Serviços** | CRUD: nome, duração, intervalo após, preço opcional, ativo, ordem, quem realiza |
| **Profissionais** | CRUD, com expediente semanal (faixas por dia) e serviços que realiza |
| **Bloqueios e feriados** | Bloqueios da empresa ou de um profissional por período |
| **Clientes** | Lista, próximos e passados agendamentos, editar nome, **pausar o bot** para o contato |
| **Atendimentos** | Contatos em modo humano (pediram atendente ou o dono respondeu pelo celular), com "Devolver ao bot". Badge no menu |
| **WhatsApp** | Números da empresa: status, conectar por QR, desconectar, reconectar, remover, rótulo |
| **Configurações** | Dados da empresa, fuso, regras de agenda e do bot (§5 Tenant), textos do bot com pré-visualização, equipe (convidar e remover usuários) |

### Plataforma (`/(platform)/admin/…`, só `isPlatformAdmin`)
| Tela | Propósito |
|---|---|
| **Empresas** | Criar empresa + dono (link de convite copiável), suspender, limite de números |
| **Configurações da plataforma** | URL e chave da Evolution (mascarada), URL base do webhook do n8n, gerar ou rotacionar o segredo da API interna, "Reaplicar webhooks" |
| **Saúde** | Todas as instâncias com status e última conexão, e contagem de `InboundEvent` com erro ou `UNRESOLVABLE_SENDER` nas últimas 24 h |

### Autenticação
Login, aceitar convite (define a senha) e trocar senha. **Sem cadastro público e sem "esqueci a
senha" por e-mail na v1** (não há SMTP): o admin da plataforma gera um novo link de convite.

---

## 8. Estrutura de pastas

```
src/
├─ app/                        casca fina: rotas, layouts, server actions → chamam modules
│  ├─ (auth)/  (app)/[tenantSlug]/…  (platform)/admin/…
│  └─ api/internal/v1/evolution/events/route.ts · api/whatsapp/… · api/agenda/slots
├─ core/                       domínio puro, sem I/O
│  ├─ agenda/                  slots.ts, rules.ts, window.ts (fuso)
│  └─ bot/                     machine.ts (step), render.ts (textos), parse.ts (entrada → opção)
├─ modules/                    serviços: agenda/, bot/, whatsapp/, tenant/, platform/, contacts/
├─ adapters/evolution/         único lugar que conhece a API e o payload da Evolution
└─ lib/                        db/ (prisma + forTenant), auth.ts, logger.ts (com redação de PII)
```
Regra de dependência: `app → modules → core ← adapters`. `core` não importa Next, Prisma nem SDK.

---

## 9. Segurança e LGPD (resumo para o Órion)

- Isolamento entre tenants: `forTenant()` + lint + teste que falha se um modelo com escopo for
  consultado sem escopo. O tenant vem da sessão ou do `webhookToken`, nunca do corpo.
- Segredos da plataforma no banco (decisão do dono): a chave da Evolution é mascarada na UI e só é
  lida pelo adaptador. O segredo da API interna é guardado como hash. Cifrar a chave da Evolution
  em repouso é **dívida consciente** herdada do InnoAtendente (pendência 6 de lá).
- `webhookToken` com 32 bytes aleatórios, e o endpoint interno exige também o Bearer: vazar a URL
  do webhook sozinha não permite forjar mensagens.
- Rate limit no endpoint interno e no login: na borda (Easypanel/proxy) ou em memória (instância
  única). O Órion decide na Fase 7.
- Logs sem conteúdo de mensagem e com telefone mascarado. `InboundEvent` sem conteúdo. Execuções do
  n8n sem dados salvos em caso de sucesso.
- Dados coletados do cliente final: nome, telefone, serviço e horário. O bot não pergunta sintoma
  nem motivo da consulta.

---

## 10. Riscos

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| 1 | **LID / remetente sem número** (§6.3) | Resposta não chega (~9% relatado em integrações) | Normalização com `remoteJidAlt`/`senderPn`, fixtures reais na Fase 0, métrica `UNRESOLVABLE_SENDER` na tela de Saúde, versão da Evolution fixada |
| 2 | **Regressão da Evolution ao atualizar** (já ocorreu entre 2.2.x e 2.3.x) | Bot mudo para todos | Versão fixada no Easypanel; o adaptador isola o formato; suíte de fixtures roda antes de qualquer atualização |
| 3 | **n8n fora do ar** | Mensagens não respondidas (a Evolution não reenfileira para sempre) | Workflow simples; alerta de erro; o painel mostra "última mensagem processada há X" na tela de Saúde. Aceito na v1 |
| 4 | **Evolution compartilhada com o InnoAtendente** | Colisão de nome ou disputa de recursos | Prefixo `innochat-`; limite de números por empresa; monitorar RAM da VPS |
| 5 | **Banimento do número** (API não oficial) | Empresa sem canal | Só responde a quem escreveu, com "digitando", no máximo 3 mensagens por turno, sem disparo em massa; alerta de desconexão |
| 6 | **Double booking** | Dois clientes no mesmo horário | Constraint `EXCLUDE` + teste de concorrência (Íris) |
| 7 | **Bot atropelando o humano** | Péssima experiência | Modo `HUMAN`, pausa por `fromMe` humano (validar na Fase 0), pausa manual no painel |
| 8 | **Dados pessoais nas execuções do n8n** | Exposição LGPD fora do produto | Não salvar execuções de sucesso; prune de erros em 7 dias |
| 9 | **VPS única** | Tudo fora do ar junto | Backup do Postgres com restauração testada; aceito na v1 |
| 10 | **Fuso** | Horário deslocado | Hora local para recorrência, instante para agendamento, `date-fns-tz`, testes com fuso da máquina ≠ fuso do tenant |

### Dívidas conscientes
1. Sem transcrição de conversa. 2. Sem reserva temporária de horário entre oferta e confirmação.
3. Semântica "no máximo uma vez" na resposta (§2, regra 1). 4. Todos os números da empresa
compartilham a agenda. 5. Chave da Evolution sem cifragem em repouso. 6. Sem lembretes, cobrança
ou cadastro público na v1.

---

## 11. Plano faseado

Legenda: 🔑 = depende de dado do dono. ∥ = pode rodar em paralelo.

| Fase | Entrega | Quem | Depende de |
|---|---|---|---|
| **0. Dados do dono + spike Evolution** | Versão exata da Evolution; URL e chave; URL pública do n8n (e se está na mesma rede do Easypanel); domínio do painel. Criar **uma instância de teste** e capturar payloads reais: texto, `extendedTextMessage`, `@lid` (se houver), `fromMe` enviado pelo celular, eco do `sendText`, `connection.update`. Testar `sendText` para `@lid`. Resultado: `fixtures/evolution/*.json` | Atlas + Vega | 🔑 dono |
| **1. Fundação** | Esqueleto Next/TS/Tailwind v4/Prisma/Auth.js; `forTenant` + lint; schema de identidade (User, Tenant, Membership, PlatformSettings, WhatsappInstance); admin da plataforma (empresas, configurações com chave mascarada, segredo interno); convite e login; `Dockerfile`; `docs/contratos.md` (Server Actions) | Cronos (schema) ∥ Vega (app/auth) ∥ Lyra (design system + shell do painel) ∥ Vulcano (Dockerfile, serviço no Easypanel, Postgres) | — (o deploy precisa do domínio 🔑) |
| **2. Catálogo e agenda** | Service, Professional, WorkingHour, ScheduleException, Contact, Appointment + `EXCLUDE`; `core/agenda` (slots, com teste de fuso); `AgendaService.book/cancel/reschedule`; telas Serviços, Profissionais, Bloqueios, Agenda, Agendamentos | Cronos → Vega (motor) ∥ Lyra (telas, contra o contrato) → Íris (concorrência + fuso) | 1 |
| **3. Conexão WhatsApp** ∥ com a 2 | Adaptador Evolution (instância, webhook/set, QR, estado, logout, delete); tela WhatsApp com modal de QR; status por evento | Vega ∥ Lyra → Íris | 1, 0 🔑 |
| **4. Motor do bot** | ChatSession, InboundEvent, BotText; `core/bot` (máquina de estados + parse + render); `POST /api/internal/v1/evolution/events`; normalização com as fixtures da Fase 0; testes de todas as transições, duplicata, sessão expirada, entrada inválida, `SLOT_TAKEN`, eco `fromMe` | Cronos (tabelas) → Vega → Íris | 2, 0 (fixtures) |
| **5. Workflow n8n** | Webhook → events → sendText; workflow de erro; retenção de execuções. **Pode começar na Fase 3** com o painel devolvendo resposta fixa (o contrato §6.2 está fechado) | Atlas via MCP | contrato (§6.2) ∥; ponta a ponta precisa de 3 + 4; URL do n8n 🔑 |
| **6. Operação humana** | Telas Clientes, Atendimentos, textos do bot com pré-visualização; pausa por `fromMe`; tela Saúde | Vega ∥ Lyra → Íris | 4 |
| **7. Endurecimento e entrega** | Revisão OWASP e isolamento (Órion); E2E do painel e teste ponta a ponta real por WhatsApp (Íris); backup com restauração testada, deploy com rollback (Vulcano); documentação (Alexandria) | Órion ∥ Íris ∥ Vulcano → Alexandria | 5, 6 |
| *Pós-v1* | Lembretes (n8n Schedule + `GET /reminders/due`), confirmação de presença, cadastro público + cobrança, número por unidade, Cloud API oficial com botões | — | decisão do dono |

Caminho crítico: **0 → 1 → 2 → 4 → 5 (ponta a ponta) → 7**. Paralelos principais: a Fase 3 corre
junto com a 2; a Lyra trabalha contra contrato em todas as fases; o esqueleto do n8n (5) sai
junto com a 3.

---

## 12. Convenções herdadas do InnoAtendente (valem aqui)

- Credenciais da plataforma no banco (`PlatformSettings`), editadas só por `isPlatformAdmin`,
  sempre mascaradas. **Nunca em env var** (decisão do dono).
- Um Dockerfile por serviço no Easypanel (não existe campo de *build target*).
- Migration antes do push que a usa (o auto-deploy por Git pode estar ligado); a migration nunca
  roda no boot; `NEXT_PUBLIC_APP_URL`/`AUTH_URL` com **um** domínio só.
- Um fuso por empresa (`Tenant.timezone`); `new Date()` só por componentes, nunca dependendo do
  fuso da máquina.
- Normalização do 9º dígito BR só para exibição; o envio usa o JID recebido.
- "Teste passou" não é prova quando o bug é de volume ou de concorrência: o teste de concorrência
  roda contra Postgres real.

---

## 13. Decisões que dependem do dono

1. **Motor do menu no painel (recomendado) ou no n8n?** A recomendação está na §2. Se o dono quiser
   o menu desenhado no n8n para editar ele mesmo, a arquitetura muda para "n8n chama endpoints
   granulares" e perdemos transação e testes. A decisão vale para as Fases 4 e 5.
2. **Onboarding na v1:** o admin da plataforma cria empresa e dono (proposto) ou cadastro público
   com cobrança?
3. **Limite padrão de números por empresa** (proposto: 1, ampliável pelo admin).
4. **Dados de infraestrutura** 🔑: versão, URL e chave da Evolution; URL do n8n e se ele está na
   mesma VPS/rede do Easypanel; domínio do painel (sugestão: `innochat.innovarecode.com.br`).
5. **Chave da Evolution como credencial dentro do n8n** (necessária para o n8n enviar). A
   alternativa, com o painel enviando, esvaziaria o papel do n8n.
6. **Sem transcrição de conversa na v1** (proposto) ou guardar mensagens com retenção?
7. **Lembrete de véspera na v1** ou pós-v1 (proposto: pós-v1)?
8. **Preço no menu de serviços:** mostrar quando preenchido (proposto) ou nunca?
