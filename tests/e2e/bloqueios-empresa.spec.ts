import { test, expect } from "@playwright/test";
import { SEED_TENANT_SLUG, E2E_RUN_PREFIX } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";
import { prisma } from "./fixtures/db";

// Sessão via `storageState` (ver `admin-secrets.spec.ts` / `login_rate_limit_e2e` na memória).
test.use({ storageState: OWNER_STORAGE_STATE });

/**
 * Configurações → Bloqueios: um feriado criado pela tela para a empresa INTEIRA
 * (`professionalId: null`) precisa aparecer em TODAS as colunas da Agenda (Ana e Bruna, seed) e
 * impedir o clique de "novo agendamento" naquele período — não só o de UM profissional (esse é
 * o achado registrado em `.claude/agent-memory/iris/bugs_found_log.md`: antes desta tela existir,
 * só dava para criar isso direto no banco).
 */

function nextWeekdayISO(targetWeekday: number, minDaysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + minDaysAhead);
  while (d.getDay() !== targetWeekday) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Segunda-feira (mesma convenção de `startOfWeekISO` do agenda-client.tsx) da semana que contém `dateISO`. */
function mondayOfISO(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  const wd = d.getUTCDay(); // 0=domingo
  const diff = (wd + 6) % 7; // dias desde segunda
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

/** Quantas semanas (segunda a segunda) separam hoje da data do feriado — usado para saber quantas
 * vezes clicar em "Próximo período" na visão Semana. `Math.ceil(daysAhead/7)` superestima quando o
 * dia cai perto do fim da semana seguinte (achado ao rodar este teste: 8 dias à frente de uma
 * segunda ainda é só 1 semana adiante, não 2). */
function weeksBetween(fromISO: string, toISO: string): number {
  const fromMonday = new Date(`${mondayOfISO(fromISO)}T00:00:00Z`).getTime();
  const toMonday = new Date(`${mondayOfISO(toISO)}T00:00:00Z`).getTime();
  return Math.round((toMonday - fromMonday) / (7 * 86_400_000));
}

// Terça-feira (weekday 2), pelo menos 3 dias no futuro — dentro do expediente de Ana/Bruna (seed: ter-sáb, 09:00-18:00).
const HOLIDAY_DATE_ISO = nextWeekdayISO(2, 3);
const HOLIDAY_REASON = `${E2E_RUN_PREFIX} feriado empresa inteira via UI Bloqueios`;

test.describe("Bloqueios da empresa inteira aparecem em toda a Agenda", () => {
  test.afterEach(async () => {
    await prisma.scheduleException.deleteMany({ where: { reason: HOLIDAY_REASON } });
  });

  test("feriado criado em Configurações → Bloqueios aparece nas colunas de Ana E Bruna, e bloqueia o clique", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/configuracoes/bloqueios`);
    await page.getByRole("button", { name: "Novo bloqueio/feriado" }).first().click();
    await page.getByLabel("Tipo").selectOption("HOLIDAY");
    await page.getByLabel("Início").fill(`${HOLIDAY_DATE_ISO}T10:00`);
    await page.getByLabel("Fim").fill(`${HOLIDAY_DATE_ISO}T17:00`);
    await page.getByLabel("Motivo (opcional)").fill(HOLIDAY_REASON);
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByText("Feriado cadastrado.").first()).toBeVisible();
    await expect(page.getByText(HOLIDAY_REASON)).toBeVisible();

    // Vai para a Agenda, no dia do feriado, visão "Dia" (colunas por profissional).
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    // Navega até a data certa usando "Próximo período" repetidamente a partir de hoje (evita
    // depender de um seletor de data que a tela não expõe diretamente).
    const todayISO = new Date().toISOString().slice(0, 10);
    const daysAhead = Math.round((new Date(HOLIDAY_DATE_ISO).getTime() - new Date(todayISO).getTime()) / 86_400_000);
    for (let i = 0; i < daysAhead; i++) {
      await page.getByRole("button", { name: "Próximo período" }).click();
    }

    // A faixa do feriado tem o motivo como rótulo visível — precisa aparecer MAIS DE UMA VEZ na
    // tela (uma por coluna de profissional: Ana e Bruna), não só uma.
    const bandLabel = page.getByText(HOLIDAY_REASON, { exact: false });
    await expect(bandLabel.first()).toBeVisible({ timeout: 10_000 });
    const count = await bandLabel.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Clicar em cima da faixa do feriado (dentro do expediente, período do feriado) não abre o
    // diálogo de novo agendamento — a faixa intercepta o clique (fica por cima do botão de slot).
    await bandLabel.first().click({ force: true });
    await expect(page.getByRole("dialog").filter({ hasText: "Novo agendamento" })).toBeHidden();
  });

  test("feriado da empresa inteira também aparece na visão Semana, mesmo filtrando por um profissional", async ({ page }) => {
    await prisma.scheduleException.create({
      data: {
        tenantId: (await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } })).id,
        professionalId: null,
        type: "HOLIDAY",
        startsAt: new Date(`${HOLIDAY_DATE_ISO}T10:00:00-03:00`),
        endsAt: new Date(`${HOLIDAY_DATE_ISO}T17:00:00-03:00`),
        reason: HOLIDAY_REASON,
      },
    });

    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await page.getByRole("button", { name: "Semana" }).click();

    // Navega até a semana do feriado.
    const todayISO = new Date().toISOString().slice(0, 10);
    const weeksAhead = weeksBetween(todayISO, HOLIDAY_DATE_ISO);
    for (let i = 0; i < weeksAhead; i++) {
      await page.getByRole("button", { name: "Próximo período" }).click();
    }

    await expect(page.getByText(HOLIDAY_REASON, { exact: false }).first()).toBeVisible({ timeout: 10_000 });

    // Filtra por só um profissional — o feriado da empresa inteira precisa continuar visível
    // (professionalId: null vale para TODOS, inclusive quando um só está selecionado).
    await page.getByLabel("Filtrar semana por profissional").selectOption({ label: "Ana" });
    await expect(page.getByText(HOLIDAY_REASON, { exact: false }).first()).toBeVisible();
  });
});
