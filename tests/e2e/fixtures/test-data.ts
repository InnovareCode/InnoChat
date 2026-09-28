import fs from "node:fs";

/**
 * `global-setup.ts` roda no processo principal do Playwright; cada arquivo de spec roda no seu
 * próprio worker. Um prefixo gerado com `Date.now()` neste módulo teria um valor DIFERENTE em
 * cada processo (o módulo é reavaliado em cada um) — foi exatamente o bug que quebrou o login do
 * STAFF na primeira versão desta suíte (e-mail criado no setup não batia com o e-mail que o
 * teste tentava logar). Por isso os identificadores gerados no run (slugs/e-mails com timestamp)
 * são escritos em disco pelo `global-setup.ts` e lidos daqui — nunca recalculados.
 */
const FIXTURE_FILE = "./tests/e2e/.e2e-fixture-ids.json";

export const SEED_TENANT_SLUG = "studio-demo";
export const SEED_OWNER_EMAIL = "dev@innochat.local";
export const SEED_OWNER_PASSWORD = "innochat-dev-2026";

export const TENANT_B_OWNER_PASSWORD = "e2e-owner-b-pass-2026";
export const STAFF_PASSWORD = "e2e-staff-pass-2026";

// Marca ESTÁVEL usada por `global-teardown.ts` para limpar por `contains`, mesmo de execuções
// anteriores interrompidas antes do teardown rodar.
export const STABLE_MARKER = "E2E_TEST_DATA";

/**
 * Prefixo para nomear dados que uma spec cria (serviço, profissional, contato, motivo de
 * bloqueio) — usado SÓ dentro do processo do próprio spec (nunca precisa bater entre processos,
 * diferente dos e-mails de login abaixo), então pode ser recalculado livremente aqui.
 */
export const E2E_RUN_PREFIX = `${STABLE_MARKER}_${Date.now()}`;

export type RunFixtures = {
  runPrefix: string;
  tenantBSlug: string;
  tenantBOwnerEmail: string;
  staffEmail: string;
  tenantBId: string;
  professionalBId: string;
  tenantSeedId: string;
};

/** Gera (uma vez, no processo do `global-setup.ts`) os identificadores desta execução. */
export function generateRunFixtures(): Omit<RunFixtures, "tenantBId" | "professionalBId" | "tenantSeedId"> {
  const runPrefix = `${STABLE_MARKER.toLowerCase()}_${Date.now()}`;
  return {
    runPrefix,
    tenantBSlug: `${runPrefix}-empresa-b`,
    tenantBOwnerEmail: `${runPrefix}-owner-b@e2e.innochat.local`,
    staffEmail: `${runPrefix}-staff@e2e.innochat.local`,
  };
}

export function saveRunFixtures(fixtures: RunFixtures) {
  fs.writeFileSync(FIXTURE_FILE, JSON.stringify(fixtures, null, 2));
}

/** Lido pelos specs (processos de worker) — os MESMOS valores que o `global-setup.ts` gerou. */
export function loadRunFixtures(): RunFixtures {
  return JSON.parse(fs.readFileSync(FIXTURE_FILE, "utf-8"));
}
