---
name: e2e-suite-layout
description: Onde está e como rodar a suíte E2E do painel InnoChat (Playwright) — config, fixtures, isolamento de dados, screenshots de evidência
metadata:
  type: project
---

- `playwright.config.ts` — sobe `npm run dev` (porta 3000, `reuseExistingServer: true`),
  `workers: 1`/`fullyParallel: false` (várias specs escrevem no MESMO tenant de seed
  `studio-demo`, corrida entre specs causaria flake de dado, não de lógica).
- `tests/e2e/global-setup.ts` / `global-teardown.ts` — criam/limpam: empresa B completa
  (isolamento entre tenants), membro STAFF na empresa de seed (restrição "só OWNER troca tema"),
  override de `maxProfessionalsOverride` (ver [[seed_tenant_plan_limit_e2e]]). Identificadores
  com timestamp são salvos em `tests/e2e/.e2e-fixture-ids.json` (gitignored) — ver
  [[e2e_playwright_multiprocess_fixture_ids]] para por que isso é obrigatório.
- `tests/e2e/fixtures/db.ts` — Prisma direto (mesma convenção dos testes de integração) para
  montar fixtures que a UI não expõe ainda (ex.: bloqueio de agenda para a empresa INTEIRA —
  não há tela para isso, só a Server Action `createScheduleExceptionAction` aceita
  `professionalId: null`; ver PARA O PRÓXIMO do handoff da rodada 2026-09-28).
- `tests/e2e/fixtures/test-data.ts` — `STABLE_MARKER = "E2E_TEST_DATA"` prefixa TUDO que a
  suíte cria (nome de serviço/profissional/contato/motivo de bloqueio) — o teardown limpa por
  `contains`, pegando inclusive sobras de execuções interrompidas antes do teardown rodar.
- Specs: `auth.spec.ts`, `tenant-isolation.spec.ts`, `catalog-and-agenda.spec.ts`,
  `slot-taken.spec.ts` (dois `browser.newContext()` disputando o mesmo slot), `themes.spec.ts`
  (troca de tema + overflow 1440/390 + screenshots), `admin-secrets.spec.ts`,
  `dates-timezone.spec.ts`.
- **Rodada 2026-09-28 (2ª sessão) acrescentou**: `admin-configuracoes.spec.ts` (checklist,
  testar conexão, sincronizar n8n contra fake, ativar/desativar bot),
  `bloqueios-empresa.spec.ts` (feriado da empresa inteira pela tela nova, bloqueia clique),
  `assinatura.spec.ts` (upgrade/downgrade/STAFF — ativa planos Essencial/Profissional
  temporariamente, ver `[[seed_tenant_plan_limit_e2e]]`), `suspensao.spec.ts` (tenant dedicado
  forçado SUSPENDED via truque de `currentPeriodEnd` no passado), `cadastro.spec.ts` (ponta a
  ponta com SMTP fake, achou o bug do link de redefinir senha), `csp.spec.ts` (violações de CSP
  via `securitypolicyviolation`), `whatsapp.spec.ts` (Evolution fake própria,
  `fixtures/fake-evolution-server.ts` — achou o bug do diálogo de sucesso sumindo na 1ª conexão).
  `instalacao.spec.ts` é a EXCEÇÃO: roda numa config separada
  (`playwright.instalacao.config.ts`, sem `webServer`) — ver
  `[[next_dev_single_instance_lock]]`. Fixtures novas em `tests/e2e/fixtures/`:
  `fake-http-server.ts` (mock HTTP genérico, usado por n8n/Evolution), `fake-smtp-server.ts`
  (captura e-mail real via SMTP cru), `fake-evolution-server.ts`, `csp.ts`, `test-db-url.ts`
  (deriva `innochat_test` do `.env` sem nunca imprimir a string).
- **Rodada C1 (2026-09-29, visual premium/Clientes/drag/Ctrl+K)** acrescentou: `clientes.spec.ts`
  (busca/filtros, `CONTACT_EXISTS`, pausar/retomar bot, excluir com/sem histórico, CSV com
  neutralização de fórmula), `drag-reschedule.spec.ts` (arrastar para remarcar — ver
  [[dnd_kit_drag_testing]]), `command-palette.spec.ts` (Ctrl+K), `smoke.spec.ts` (todas as rotas,
  painel/admin/públicas, rede de segurança contra "ícone como prop Server→Client"),
  `responsive.spec.ts` (360/768/1024/1440 em todas as rotas, `scrollWidth<=clientWidth`),
  `assinatura-pix.spec.ts` (RATE_LIMITED em "Gerar Pix agora" — MISSING_DOCUMENT só é testável em
  integração, ver [[mercadopago_no_fake_server]]), `admin-cobranca.spec.ts` (marcar como paga com
  motivo obrigatório e duplo clique, regerar Pix), `admin-saude.spec.ts`,
  `admin-dados-juridicos.spec.ts` (salva e confirma em `/termos`, limpa os dados no final). CPF
  válido/inválido entrou em `cadastro.spec.ts` (ver [[signup_rate_limit_e2e]] — agora 5/5 do teto
  de sinal por rodada).
- Rodar: `npm run test:e2e` (script adicionado ao `package.json`, NÃO inclui `instalacao.spec.ts`
  — `testIgnore` no `playwright.config.ts`), `npx playwright test <arquivo>` para uma spec
  isolada, ou `npx playwright test --config=playwright.instalacao.config.ts` só para
  `/instalacao`.
- Specs com muitos testes usando o MESMO usuário devem reusar cookie de sessão em vez de logar de
  novo a cada teste — ver `[[login_rate_limit_e2e]]` (8 logins/15min por e-mail).
- Todo `getByLabel(..., { exact: true })` num campo `required` precisa do `" *"` no texto — ver
  `[[playwright_required_field_asterisk_label]]`.
- Screenshots de evidência ficam em `docs/design/screens/qa/` (Agenda dia/semana × 3 temas ×
  1440/390, + agenda com bloqueio) — commitadas, não são artefato de execução (diferente de
  `test-results/`/`playwright-report/`, esses sim no `.gitignore`).
- 25 testes na 1ª rodada, +~40 na 2ª (excluindo `instalacao.spec.ts`, 4 testes à parte); suíte
  principal roda em ~5-6min contra `npm run dev` (cresceu bastante com os fakes de rede/SMTP —
  ainda não testado contra `next build && next start`).
