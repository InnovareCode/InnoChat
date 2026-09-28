import { test, expect, type Page } from "@playwright/test";
import { login } from "./fixtures/auth";
import { prisma } from "./fixtures/db";
import { SEED_TENANT_SLUG, STAFF_PASSWORD, E2E_RUN_PREFIX, loadRunFixtures } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";

const THEMES = [
  { value: "INDIGO_CLINICO", label: "Índigo Clínico" },
  { value: "AMBAR_ESTUDIO", label: "Âmbar Estúdio" },
  { value: "VERDE_SLATE", label: "Verde Slate" },
] as const;

const SCREENS_DIR = "docs/design/screens/qa";

async function noHorizontalOverflow(page: Page): Promise<{ ok: boolean; scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    ok: document.documentElement.scrollWidth === document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

test.describe("Temas do painel (docs/contratos.md Fase 1 — Configurações → Aparência)", () => {
  // OWNER via `storageState` (gerado uma vez em `global-setup.ts`) — ver `login_rate_limit_e2e`
  // na memória; STAFF (abaixo) continua com login real de verdade, aparece só 1x na suíte.
  test.use({ storageState: OWNER_STORAGE_STATE });

  test("OWNER troca o tema em Configurações → Aparência e o painel reflete no data-theme", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/configuracoes/aparencia`);
    await page.getByRole("radio", { name: /Âmbar Estúdio/ }).check({ force: true });
    await page.getByRole("button", { name: "Salvar tema" }).click();
    await expect(page.getByText("Tema salvo. Toda a equipe já vê o novo visual.")).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "AMBAR_ESTUDIO");

    // Devolve para o tema padrão, para não afetar os próximos testes desta sessão.
    await page.getByRole("radio", { name: /Índigo Clínico/ }).check({ force: true });
    await page.getByRole("button", { name: "Salvar tema" }).click();
    await expect(page.getByText("Tema salvo. Toda a equipe já vê o novo visual.")).toBeVisible();
  });

  test("STAFF (não-OWNER) NÃO consegue trocar o tema", async ({ page }) => {
    const { staffEmail } = loadRunFixtures();
    await login(page, staffEmail, STAFF_PASSWORD);
    await page.waitForURL(new RegExp(`/${SEED_TENANT_SLUG}(/|$)`));

    await page.goto(`/${SEED_TENANT_SLUG}/configuracoes/aparencia`);
    await page.getByRole("radio", { name: /Verde Slate/ }).check({ force: true });
    await page.getByRole("button", { name: "Salvar tema" }).click();
    await expect(page.getByText("Só o dono da empresa pode trocar o tema.")).toBeVisible();

    // Confirma que NADA mudou no banco (o STAFF não conseguiu, mesmo tendo enviado o form).
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });
    expect(tenant.theme).toBe("INDIGO_CLINICO");
  });

  for (const viewport of [
    { name: "1440", width: 1440, height: 900 },
    { name: "390", width: 390, height: 844 },
  ]) {
    test(`3 temas sem overflow horizontal na Agenda (dia e semana) em ${viewport.name}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      for (const theme of THEMES) {
        await setTheme(page, theme.value);

        await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
        await page.waitForLoadState("networkidle");
        const dayResult = await noHorizontalOverflow(page);
        expect(dayResult.ok, `Dia/${theme.value}/${viewport.name}: scrollWidth=${dayResult.scrollWidth} clientWidth=${dayResult.clientWidth}`).toBe(true);
        await page.screenshot({ path: `${SCREENS_DIR}/agenda-dia-${theme.value}-${viewport.name}.png`, fullPage: true });

        await page.getByRole("button", { name: "Semana" }).click();
        await page.waitForLoadState("networkidle");
        const weekResult = await noHorizontalOverflow(page);
        expect(weekResult.ok, `Semana/${theme.value}/${viewport.name}: scrollWidth=${weekResult.scrollWidth} clientWidth=${weekResult.clientWidth}`).toBe(true);
        await page.screenshot({ path: `${SCREENS_DIR}/agenda-semana-${theme.value}-${viewport.name}.png`, fullPage: true });
      }

      await setTheme(page, "INDIGO_CLINICO"); // devolve ao padrão para os próximos testes
    });
  }

  test("screenshot de evidência: Agenda com bloqueio visível", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });
    const targetDay = nextWeekdayISO(3); // quarta — dia de expediente normal
    const reason = `${E2E_RUN_PREFIX} bloqueio para screenshot`;
    await prisma.scheduleException.create({
      data: {
        tenantId: tenant.id,
        professionalId: null,
        type: "BLOCK",
        startsAt: new Date(`${targetDay}T14:00:00-03:00`),
        endsAt: new Date(`${targetDay}T16:00:00-03:00`),
        reason,
      },
    });

    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await setAgendaDate(page, targetDay);
    await expect(page.getByText(reason).first()).toBeVisible();
    await page.screenshot({ path: `${SCREENS_DIR}/agenda-com-bloqueio.png`, fullPage: true });

    await prisma.scheduleException.deleteMany({ where: { reason } });
  });
});

async function setTheme(page: Page, theme: (typeof THEMES)[number]["value"]) {
  await page.goto(`/${SEED_TENANT_SLUG}/configuracoes/aparencia`);
  const label = THEMES.find((t) => t.value === theme)!.label;
  await page.getByRole("radio", { name: new RegExp(label) }).check({ force: true });
  await page.getByRole("button", { name: "Salvar tema" }).click();
  await expect(page.getByText("Tema salvo. Toda a equipe já vê o novo visual.")).toBeVisible();
}

function nextWeekdayISO(weekday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function setAgendaDate(page: Page, dateISO: string) {
  await page.getByRole("button", { name: "Hoje" }).click();
  const today = new Date();
  const [y, m, d] = dateISO.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const diffDays = Math.round(
    (target.setHours(0, 0, 0, 0) - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000,
  );
  const next = page.getByRole("button", { name: "Próximo período" });
  const prev = page.getByRole("button", { name: "Período anterior" });
  const steps = Math.abs(diffDays);
  for (let i = 0; i < steps; i++) {
    if (diffDays > 0) await next.click();
    else await prev.click();
  }
}
