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
- Rodar: `npm run test:e2e` (script adicionado ao `package.json`), ou
  `npx playwright test <arquivo>` para uma spec isolada durante desenvolvimento.
- Screenshots de evidência ficam em `docs/design/screens/qa/` (Agenda dia/semana × 3 temas ×
  1440/390, + agenda com bloqueio) — commitadas, não são artefato de execução (diferente de
  `test-results/`/`playwright-report/`, esses sim no `.gitignore`).
- 25 testes, suíte inteira roda em ~90s contra `npm run dev` (não testado contra `next build && next start`, mais fiel a produção mas mais lento — considerar para CI).
