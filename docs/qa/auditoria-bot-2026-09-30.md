# Auditoria do fluxo de agendamento do bot — 2026-09-30

Autora: Íris (QA). Escopo: `n8n/innochat-bot.json` (Code nodes reais) + API interna (`src/modules/bot-api/*`, `src/core/agenda`, `src/core/bot`).
Método: simulador em `scripts/bot-sim/` (ver `README.md` de lá). Ele executa o JS exato dos Code nodes seguindo as conexões do JSON e chama a API interna **real** (build de produção, porta 3900, banco dedicado `innochat_botsim`). A Evolution é falsa. 61 cenários, ~250 verificações: **25 cenários falham (= bugs/gaps abaixo), 36 passam**. Estado do código: commit `4757b84`.

## O que foi e o que NÃO foi provado

Provado (executado): toda a lógica de menu, paginação, texto/número, nome, confirmação, SLOT_TAKEN (inclusive corrida real com `Promise.all`), remarcar/cancelar, prazo, sessão expirada, pausa/humano, dedupe, STALE, fusos (Tóquio, Honolulu, Kiritimati), bloqueio/feriado, edição de textos do bot.
**Não provado**: envio real pela Evolution (eco `fromMe` do próprio bot, falha de envio), timeouts/retry reais do n8n, credenciais, o relógio (a virada de meia-noite só foi coberta indiretamente por fusos que já estão em "outro dia" vs UTC), DST. O relatório separa isso em "Riscos não reproduzidos".
Passou (comportamento correto, sem ação): dedupe (`DUPLICATE`), mensagem >5 min (`STALE`), dois clientes simultâneos, 3 mensagens rápidas do mesmo cliente (serializadas pela trava), corrida real de dois clientes no mesmo horário (1 confirma, 1 recebe SLOT_TAKEN), SLOT_TAKEN na reserva e na remarcação com alternativas, bloqueio/feriado da empresa esconde o dia, fusos Tóquio/Honolulu coerentes de ponta a ponta, mídia (áudio/imagem/figurinha/vazio) responde "só entendo texto" sem contar como inválida, sessão velha reinicia, bot pausado/fromMe silenciam, acentos/maiúsculas em `menu`/`sair`/nomes de serviço, números enormes/estranhos, remarcar completo, cancelar/remarcar item já cancelado no painel (idempotente), serviço/profissional inativos não aparecem.

## Bugs (priorizados)

Severidade: crítico = perde reserva/silencia o bot em uso normal; alto = cliente fica sem resposta ou dado errado gravado; médio = confunde/erra mas há saída; baixo = raro/cosmético. Cenário = id em `scripts/bot-sim/scenarios*.mjs`. Linhas dos Code nodes contam a partir da 1ª linha do `jsCode`.

### BUG-01 — Crítico — "sim", "ok", "s", 👍, ✅ na confirmação não são entendidos; 3 erros seguidos chamam atendente e calam o bot
- Reprodução (D5, C1, D6): agendar até "Confirma o agendamento?" → cliente responde `sim`, depois `ok`.
- Esperado: confirmar. Obtido: `Não entendi essa opção.` + a confirmação de novo; 3ª resposta inválida (`abc`,`sim`,`ok`): `Não consegui entender. Vou chamar um atendente para te ajudar.` e o bot para por 12 h (BUG-02).
- Rejeitados também: `s`, `confirmo`, `isso`, `pode ser`, `Confirmar!`, `não`, `nao`, `n`, `👍`, `✅`, `👍🏽`. Só aceita `1`, `confirmar` (ou prefixo único `c`). No cancelamento `sim`/`não`/`s`/`n` funcionam (por acaso: os rótulos começam com "Sim,"/"Não,"), `ok` não.
- Causa raiz: `Interpretar` linhas 39-46 casam só o número ou o rótulo/prefixo do rótulo; `MENUS.CONFIRM` (Montar mensagem l.10) tem rótulos "Confirmar"/"Escolher outro horário". `TOO_MANY_INVALID` em `Interpretar` l.53-54.
- Correção: aliases por estado (CONFIRM: sim/s/ok/confirmo/isso/pode ser/👍/✅ = confirmar; não/n/nao = escolher outro horário ou voltar; CONFIRM_CANCEL idem), normalizar emoji. Não transferir para humano automaticamente na 3ª inválida na confirmação (ver BUG-02).

### BUG-02 — Alto — Transferência para humano silencia o bot por 12 h sem aviso e sem volta
- Reprodução (D3, O1): 3 entradas inválidas em qualquer etapa (ou opção 3). Depois, cliente digita `menu`/`oi`.
- Obtido: silêncio (`claim=ignore/HUMAN_MODE`) até `humanUntil` (= `humanPauseMin` 720 min). A mensagem de handoff (`TOO_MANY_INVALID`/`HUMAN_HANDOFF`) não diz quando o bot volta nem que "menu" não funciona. Não encontrei notificação ao dono/atendente no caminho de handoff (grep em `src`): se ninguém está olhando o celular, o cliente fica 12 h sem resposta.
- Causa: `Interpretar` l.53-54 → `handoff:true`; `session.ts` (`humanUntil`); `claim.ts:202`.
- Correção: 3ª inválida NÃO deve mutar; oferecer "digite 3 para falar com atendente". Handoff explícito: dizer o horário de atendimento e permitir `menu` para retomar (ou pausa curta configurável). Avisar o painel (sino) no handoff.

### BUG-03 — Alto — O passo "qual é o seu nome?" aceita qualquer texto e grava como nome do cliente
- Reprodução (F1, F2, C3): chegar em "Antes de continuar, qual é o seu nome?" e digitar `oi`, `voltar`, `cancelar`, `sim`, `inicio`, `ajuda`, `😀😀`, `..`, `1 2`, `<script>alert(1)</script>`.
- Obtido: segue para "Confirma o agendamento?" e o valor vira `Contact.name` (aparece no painel e na saudação "Olá, oi!"). Só `menu`/`0`/`sair` são interceptados antes.
- Causa: `Interpretar` l.35-37 (`ASK_NAME` aceita 2-60 chars não numéricos); grava já no PATCH, antes da confirmação.
- Correção: lista de palavras de controle (voltar, cancelar, oi, sim, não, ajuda...) tratadas como comando, exigir ≥2 letras (`\p{L}`), rejeitar emoji/pontuação puros, gravar o nome só ao confirmar. Órion: nome com `<script>` é armazenado (a UI React escapa, mas vale sanear).

### BUG-04 — Alto — Erro/404 do painel deixa o cliente sem resposta (bot "mudo")
- Reprodução (W1, W2): cliente abre a lista de serviços; o dono desativa o serviço (ou a profissional) no painel; cliente escolhe (a sessão dura 30 min).
- Obtido: nenhuma mensagem; execução falha com `Buscar profissionais: HTTP 404 ... Serviço não encontrado.` / `Buscar dias: HTTP 404 ... Profissional não encontrado.`. A sessão fica no estado anterior, então repetir gera o mesmo silêncio. Vale para qualquer 5xx/timeout do painel nos nós GET e em `Claim`.
- Causa: `Buscar serviços/profissionais/dias/horários/meus agendamentos` não têm `neverError`, então o n8n lança; `innochat-erros` só libera a trava (nós `Extrair trava`/`Liberar trava`), nunca responde ao cliente.
- Correção: `neverError` + tratamento de 404/5xx nos nós `Resultado …` (mensagem "Esse item mudou, vamos recomeçar" + volta ao menu), e no `innochat-erros` enviar um texto de contingência ao número (Evolution) além de liberar a trava.

### BUG-05 — Médio — "Ver mais datas" repete o último dia da página anterior
- Reprodução (R2, R4): serviço Corte → Qualquer profissional → `8` (Ver mais datas).
- Obtido: página 1 termina em `Qua 07/10`; página 2 começa com `Qua 07/10` (e a 3ª repete `Qui 15/10`). Cada página traz só 6 datas novas.
- Causa: `booking-bot.ts:121` `nextFrom: hasMore ? page[page.length - 1] : null` é inclusivo e `computeAvailableDays` usa `from` inclusivo.
- Correção: `nextFrom = addDaysISO(último, 1)`.

### BUG-06 — Médio — Paginação: numeração pula, "Ver mais" é cíclico e sem "voltar"
- Reprodução (R1, R4, N2): 13 serviços (ou >9 agendamentos). Página 1: `1..8` + `9. Ver mais`. Página 2 mostra 5 itens e `9. Ver mais` (pula 6-8); `9` de novo volta à página 1 sem aviso. Mesmo em "Meus agendamentos" (11 agendamentos).
- Causa: `Montar mensagem` l.52-66: `shown.push({ n: 9, ...})` fixo e `page % pages`.
- Correção: numerar sequencialmente, mostrar "Ver mais" só se houver próxima página e "Voltar" (ou "Ver anteriores") nas páginas seguintes.

### BUG-07 — Médio — SLOT_TAKEN mostra horários de OUTRO dia sem dizer o dia
- Reprodução (S1): profissional com 1 horário por dia; A escolhe `Sex 02/10 09:00`, B ocupa antes.
- Obtido: `Esse horário já foi ocupado. Escolha outro:` `1. 09:00` — o horário é de `Sáb 03/10`; só a tela seguinte revela ("Sáb 03/10 às 09:00").
- Causa: `Resultado reserva` l.18 (e `Resultado remarcação`) não passam `vars` (`data: alt.date`) e o texto padrão `SLOT_TAKEN` não tem `{data}`.
- Correção: passar `data` e mudar o texto padrão: "Esse horário acabou de ser ocupado. Horários livres em {data}:".

### BUG-08 — Médio — Cancelar/remarcar fora do prazo só é recusado no fim
- Reprodução (N3): agendamento em 90 min (`cancelMinLeadMin` 120). Meus agendamentos → item → Remarcar → dia → horário → Confirmar.
- Obtido: só depois de tudo: `Não é mais possível fazer isso tão perto do horário marcado. Fale com a gente diretamente.` (cancelar também só falha após o "Sim, cancelar"). Sem telefone nem opção de atendente.
- Causa: `Ação escolhida` não conhece o prazo; a regra só existe em `appointments.ts:301/329`.
- Correção: `listMyAppointmentOptions` devolver `canChange` (ou `cancelMinLeadMin`) e `Ação escolhida` recusar logo com opção de atendente.

### BUG-09 — Médio — Profissional/serviço sem expediente são oferecidos e levam a beco sem saída
- Reprodução (K1, K2): "Carla" (sem horário de trabalho) aparece em "Com quem você prefere ser atendido(a)?"; escolher leva a `Não encontrei horários disponíveis no momento. Tente novamente mais tarde.` + menu. Idem serviço sem profissional ("Limpeza de pele") ou só com profissional sem expediente; empresa sem serviços.
- Causa: `listCatalogServiceOptions`/`listCatalogProfessionalOptions` (`booking-bot.ts:19-63`) filtram só `active`, não `WorkingHour`.
- Correção: filtrar por ter expediente; mensagens distintas (ver UX-15).

### BUG-10 — Médio — Saudação com nome vazio ou lixo: "Olá, ! Bem-vindo(a)…"
- Reprodução (V2): cliente sem nome de perfil no WhatsApp (`pushName` vazio) → `Olá, ! Bem-vindo(a) à Studio Bela. 😊`; `pushName` `.` → `Olá, .!`; `~` idem. Com perfil normal usa o nome completo ("Olá, Maria Souza!").
- Causa: `Montar mensagem` l.14 `nome: contact.name || pushName || ''` e `render` (l.15-18) substitui por vazio.
- Correção: usar 1º nome só se tiver letras; senão texto alternativo sem nome ("Olá! Bem-vindo(a)…").

### BUG-11 — Médio — Editar o texto do menu (tela "Mensagens do bot") desacopla o número da ação
- Reprodução (X1): editar `MAIN_MENU` para "1. Falar com atendente / 2. Agendar / 3. Meus agendamentos"; cliente digita 2.
- Obtido: cai em "Meus agendamentos" (a ação real do 2 é fixa no workflow). Idem `APPOINTMENT_ACTIONS`. Nada valida a numeração.
- Causa: `MENUS.MAIN_MENU/APPOINTMENT_ACTIONS` (`Montar mensagem` l.8-13) têm `render:false`, a lista vem do texto livre.
- Correção: o workflow gerar as linhas numeradas e o texto editável ser só o cabeçalho.

### BUG-12 — Médio — Variável não fornecida naquela etapa aparece literal
- Reprodução (X2): `CHOOSE_DAY` = "Datas para {servico} com {profissional}:" → o cliente vê as chaves. O editor só valida "variável conhecida" globalmente (`service.ts:assertKnownVariables`).
- Causa: `render` (l.15-18) mantém `{k}` sem valor.
- Correção: variáveis permitidas por chave no editor; em `render`, remover/trocar placeholder sem valor.

### BUG-13 — Médio/baixo — Sessão expirada descarta a mensagem do cliente
- Reprodução (P1): após 20 h (ex.: resposta ao lembrete) o cliente manda `menu`, `2`, `cancelar` ou `remarcar`.
- Obtido: sempre `Faz um tempo que não conversamos, então recomecei o menu por aqui.` + menu; o comando digitado é perdido; quem respondeu "menu" ao lembrete lê "recomecei" como se fosse erro.
- Causa: `Interpretar` l.25-28 (`fresh` retorna sem processar o texto); `claim.ts` zera estado.
- Correção: se a mensagem é `menu`/`oi`/`0`, só mostrar o menu; se é opção/palavra-chave, processar como 1ª mensagem.

### BUG-14 — Baixo — `NO_SLOTS_DAY` mantém na lista o dia que ficou vazio
- Reprodução (J1): dia listado é ocupado por outro cliente antes da escolha. Obtido: "Não há horários livres neste dia. Veja outras datas:" com o mesmo dia ainda na lista (dá para entrar em loop). Causa: `Resultado horários` l.9-12 reenvia `ctx.options`.

### BUG-15 — Baixo — Rótulo do dia com +1 dia em fuso ≥ UTC+12 (NZ, Fiji, Tonga, Kiritimati)
- Reprodução (T1, tenant `kiribati`): lista mostra `Sex 02/10` para o dia local 01/10; o resumo diz "Sex 02/10 às 09:00" e a confirmação "Qui 01/10 às 09:00" (a reserva é a de 01/10).
- Causa: `booking-bot.ts:126-128` `dateISOToUtcNoon` + `formatDayLabel(..., tz)`: meio-dia UTC já é o dia seguinte com offset ≥ +12 (usado em l.119, 196, 201). Correção: montar o rótulo com meio-dia LOCAL (`fromZonedTime(iso+'T12:00', tz)`).

### BUG-16 — Baixo/médio — Grade de horários "escorrega" depois de serviço que não é múltiplo da granularidade
- Reprodução (G2): granularidade 30 min; Escova (45 min) às 09:00 → próximos horários do dia: `09:45, 10:15, 10:45, 11:15…`. Com "Qualquer profissional" a lista mistura grades diferentes.
- Causa: `availability.ts` (`computeAvailableSlots`) recomeça a grade no fim de cada ocupação (`candidate = window.start` após `subtractRanges`). Decisão de produto: manter (aproveita a agenda) ou alinhar à grade.

### BUG-17 — Baixo — Nome com mais de 60 caracteres responde "Não entendi essa opção."
- Reprodução (C3): 61 caracteres. Conta como inválida (3 = atendente, BUG-02). Causa: `Interpretar` l.35-37 → l.53-55; e `Resultado nome` 422 usa `INVALID_OPTION` como prefixo. Correção: mensagem própria ("Nome muito longo, pode abreviar?").

## Problemas de UX e texto (para o fluxo v2 da Nova)

1. **"Não entendi essa opção."** é o único erro, inclusive em telas que não têm opções (nome) e na confirmação. Melhor: dica por etapa ("Responda com o número, por exemplo 1").
2. **Sem "voltar um passo".** `0` reinicia tudo; `voltar` é inválido (ou vira nome). Errou o profissional? Recomeça do menu.
3. **Telas sem contexto**: `CHOOSE_TIME` ("Escolha um horário:") não diz o dia; `CHOOSE_DAY` não diz serviço/profissional; `CHOOSE_PROFESSIONAL` não diz o serviço. O workflow já calcula `data`, `servico`, `preco` mas os textos padrão não os usam.
4. **"Corte feminino com Qualquer profissional"** (resumo) soa errado; a profissional real só aparece após confirmar.
5. **Resumo de remarcação** = resumo de agendamento novo ("Confirma o agendamento?"), sem "de → para".
6. **"Não, manter"** volta ao menu sem dizer que o agendamento foi mantido (`Manter agendamento` não tem `textKey`). **CANCELED** não diz qual agendamento e não oferece remarcar. **BOOKED** sem preço/endereço/como cancelar.
7. **Lembrete** pede "responda *menu*", mas `cancelar`/`remarcar`/`2` digitados não são entendidos (e, após a sessão expirar, viram "recomecei o menu").
8. **`TOO_LATE`**: "Fale com a gente diretamente" sem telefone nem opção de atendente.
9. **"Não encontrei horários disponíveis no momento. Tente novamente mais tarde."** cobre ≥5 causas diferentes (empresa sem serviço, serviço sem profissional, sem expediente, 422/403 na reserva, alternativas vazias); "mais tarde" não resolve nenhuma. Textos distintos + opção de atendente.
10. **Entrada por texto limitada**: `quero agendar`, `marcar`, `atendente`, `hoje`, `amanhã`, `sexta`, `quero fazer uma escova` não funcionam; `2.`, `2)`, `#2`, `opção 2`, `2️⃣` também não. Primeira mensagem ("quero marcar corte amanhã 15h", "bom dia, gostaria de agendar") perde a intenção e só mostra a saudação.
11. **Saudação** usa o nome completo do perfil e se repete a cada sessão de 30 min; considerar 1º nome e/ou só na 1ª do dia. O nome é pedido depois de escolher o horário; poderia sugerir o nome do perfil ("Posso te chamar de Maria?").
12. **Formatação**: tudo texto puro, sem negrito (`*…*`) em títulos/datas; após BOOKED/CANCELED o menu inteiro é anexado; datas "Qua 30/09" sem indicar "hoje/amanhã".
13. **Lista de serviços** mostra serviços impossíveis de agendar (BUG-09) e 13 itens em 2 páginas; considerar categorias.
14. **Handoff** não informa prazo de resposta nem como voltar ao bot (BUG-02).
15. `0. Menu principal` em todas as telas, inclusive dentro de paginação, confunde com "voltar".

## Riscos não reproduzidos no simulador (verificar em produção/Vulcano)

- **Eco do próprio bot**: `claim.ts` compara o hash do texto enviado com `recentOutbound` (janela 2 min). Se a Evolution devolver o `fromMe` com qualquer diferença (espaço, quebra de linha), o bot vira `HUMAN_TOOK_OVER` e se cala por 12 h após a própria resposta. Conferir no painel os `InboundEvent` com `reason=HUMAN_TOOK_OVER` logo depois de mensagens do bot.
- **Salvar antes de enviar**: a sessão avança no `PUT /sessions` e só depois há o `sendText` (sem retry). Falha de envio = cliente sem tela e estado adiantado (o "1" seguinte cai na etapa errada).
- **Descarte silencioso**: `Desistir (ocupado)` após 6 esperas de 1,5 s; `STALE` (>5 min, `claim.ts:243`) ignora tudo que chega atrasado (reinício do n8n); retry do `Claim` (POST) num timeout devolve `DUPLICATE` e a mensagem some.
- **Sem limite de agendamentos por cliente**: um número criou 11 agendamentos futuros (N2). Decisão do dono.
- Mesma tupla contato+serviço+início devolve o agendamento existente mesmo com outra profissional (`createAppointmentManual` idempotente): o cliente pode ler a profissional errada. Raro.

## Ordem sugerida para a Vega

1. BUG-01 e BUG-02 (funil de confirmação + mudez de 12 h) — maior perda de reservas.
2. BUG-04 (silêncio em 404/5xx) e BUG-03 (nome).
3. BUG-05, BUG-06, BUG-07, BUG-08, BUG-09.
4. BUG-10 a BUG-13, depois 14 a 17.
Cada correção deve virar cenário verde no simulador (os cenários já descrevem o esperado). Cenários por bug: 01=D5,C1,D6; 02=D3,O1; 03=F1,F2,C3; 04=W1,W2; 05=R2,R4; 06=R1,R4,N2; 07=S1; 08=N3; 09=K1,K2; 10=V2; 11=X1; 12=X2; 13=P1; 14=J1; 15=T1; 16=G2; 17=C3. Cenários E1/E2/D2/D6 (entrada por texto/numérica/emoji) são UX (seção acima), não bugs estritos.

## Como reexecutar

Ver `scripts/bot-sim/README.md`. Resumo: `create-db.mjs` → `prisma migrate deploy` → `seed.mjs` → `next build`/`next start -p 3900` (em worktree, para não pisar na `.next` do `next dev`) → `scenarios.mjs [filtro]`. `BOTSIM_WORKFLOW=<json>` aponta para o workflow v2.
