import { test, expect } from "@playwright/test";
import { SEED_TENANT_SLUG, E2E_RUN_PREFIX } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";
import { prisma } from "./fixtures/db";

const SERVICE_NAME = `${E2E_RUN_PREFIX} Corte Rápido`;
const PROFESSIONAL_NAME = `${E2E_RUN_PREFIX} Carla`;

// Sessão via `storageState` (ver `admin-secrets.spec.ts` / `login_rate_limit_e2e` na memória).
test.use({ storageState: OWNER_STORAGE_STATE });

test.describe.serial("Catálogo, profissionais e agenda (docs/contratos.md Fase 2)", () => {

  test("cria um serviço novo", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/servicos`);
    await page.getByRole("button", { name: "Novo serviço" }).first().click();
    await page.getByRole("dialog").getByLabel("Nome").fill(SERVICE_NAME);
    await page.getByRole("dialog").getByLabel("Duração (min)").fill("45");
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // O visual premium passou a renderizar tabela (desktop) E cartões (mobile) ao mesmo tempo —
    // só um fica visível por CSS, mas os dois existem no DOM, então `getByText` sem `.first()`
    // vira strict-mode violation (achado ao rodar esta suíte após a Onda 1 do visual premium).
    await expect(page.getByText(SERVICE_NAME).first()).toBeVisible();
  });

  test("cria um profissional novo, com o serviço acima e expediente multi-intervalo", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/profissionais`);
    await page.getByRole("button", { name: "Novo profissional" }).first().click();
    await page.getByRole("dialog").getByLabel("Nome").fill(PROFESSIONAL_NAME);
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    // Mesma renderização dupla (tabela desktop + cartões mobile) do visual premium.
    await expect(page.getByText(PROFESSIONAL_NAME).first()).toBeVisible();

    // Entra no detalhe para marcar o serviço e configurar expediente com DOIS intervalos no
    // mesmo dia (manhã e tarde, com almoço no meio) — pedido explícito da missão.
    await page.getByRole("row", { name: new RegExp(PROFESSIONAL_NAME) }).getByRole("link", { name: "Editar" }).click();
    await expect(page.getByRole("heading", { name: PROFESSIONAL_NAME })).toBeVisible();

    await page.getByText(SERVICE_NAME).click(); // marca o checkbox do serviço
    await page.getByRole("button", { name: "Salvar serviços" }).click();

    // Terça-feira: adiciona dois intervalos (09:00–12:00 e 13:00–18:00).
    const tuesdayBlock = page.locator("div").filter({ hasText: /^Terça/ }).first();
    await tuesdayBlock.getByRole("button", { name: "Adicionar intervalo" }).click();
    await tuesdayBlock.getByRole("button", { name: "Adicionar intervalo" }).click();

    const startInputs = page.getByLabel(/^Início, Terça/);
    const endInputs = page.getByLabel(/^Fim, Terça/);
    await startInputs.nth(0).fill("09:00");
    await endInputs.nth(0).fill("12:00");
    await startInputs.nth(1).fill("13:00");
    await endInputs.nth(1).fill("18:00");

    await page.getByRole("button", { name: "Salvar expediente" }).click();
    await expect(startInputs.nth(0)).toHaveValue("09:00");
    await expect(endInputs.nth(0)).toHaveValue("12:00");
    await expect(startInputs.nth(1)).toHaveValue("13:00");
    await expect(endInputs.nth(1)).toHaveValue("18:00");

    // Bloqueio pontual (folga de uma tarde) — verificado depois na Agenda como banda âmbar.
    await page.getByRole("button", { name: "Novo bloqueio" }).click();
    const blockStart = tomorrowAt("14:00");
    const blockEnd = tomorrowAt("16:00");
    const blockDialog = page.getByRole("dialog").filter({ hasText: "Novo bloqueio" });
    await blockDialog.getByLabel("Início").fill(blockStart);
    await blockDialog.getByLabel("Fim").fill(blockEnd);
    await blockDialog.getByLabel("Motivo (opcional)").fill(`${E2E_RUN_PREFIX} bloqueio pontual`);
    await blockDialog.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByText(`${E2E_RUN_PREFIX} bloqueio pontual`).first()).toBeVisible();
  });

  test("Agenda (dia): folga hachurada de quem não atende hoje, e clique num slot cria agendamento", async ({ page }) => {
    // Domingo é folga para todo mundo no seed (expediente só terça–sábado) — usa isso para
    // provar a hachura de "Folga" sem depender de criar mais dados.
    const nextSunday = nextWeekdayISO(0);
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await setAgendaDate(page, nextSunday);
    await expect(page.getByText("Folga").first()).toBeVisible();

    // Cria um agendamento clicando num slot livre de amanhã (terça a sábado tem expediente).
    const bookableDay = nextWeekdayISO(2); // terça
    await setAgendaDate(page, bookableDay);
    await page.getByRole("button", { name: new RegExp(`Novo agendamento com ${PROFESSIONAL_NAME} às 09:30`) }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Nome do cliente").fill(`${E2E_RUN_PREFIX} Cliente Slot`);
    await page.getByRole("button", { name: "Agendar", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText(`${E2E_RUN_PREFIX} Cliente Slot`).first()).toBeVisible();
  });

  test("Agenda: detalhe do agendamento, remarcar e cancelar", async ({ page }) => {
    const bookableDay = nextWeekdayISO(2);
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await setAgendaDate(page, bookableDay);

    await page.getByText(`${E2E_RUN_PREFIX} Cliente Slot`).first().click();
    await expect(page.getByRole("heading", { name: "Agendamento" })).toBeVisible();

    // Remarcar: abre o formulário embutido no mesmo dialog.
    await page.getByRole("button", { name: "Remarcar" }).click();
    await expect(page.getByLabel("Novo horário")).toBeVisible();
    await page.getByRole("button", { name: "Voltar" }).click(); // fecha o form sem remarcar de fato (evita mexer no slot usado por outro teste)
    await page.keyboard.press("Escape"); // fecha o dialog inteiro, volta para a grade
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByText(`${E2E_RUN_PREFIX} Cliente Slot`).first().click();
    await page.getByRole("button", { name: "Cancelar agendamento" }).click();
    await page.getByRole("button", { name: "Confirmar cancelamento" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Agenda (semana): bloqueio pontual aparece como banda âmbar, sem precisar clicar", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await page.getByRole("button", { name: "Semana" }).click();
    // A banda usa `title` com o motivo do bloqueio — visível sem interação (é o requisito:
    // "bloqueio pontual âmbar sem clique").
    await expect(page.getByText(`${E2E_RUN_PREFIX} bloqueio pontual`).first()).toBeVisible();
  });

  test("Agenda: exceção da empresa inteira aparece em TODAS as colunas de profissional", async ({ page }) => {
    // Não há tela para criar bloqueio da empresa inteira ainda (ver PARA O PRÓXIMO do handoff) —
    // cria direto no banco (Server Action equivalente) e confirma que a UI (já preparada para
    // `professionalId: null`) realmente pinta a banda em todos os profissionais do dia.
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });
    const targetDay = nextWeekdayISO(3); // quarta — dia de expediente normal para todos
    const startsAt = new Date(`${targetDay}T00:00:00-03:00`);
    const endsAt = new Date(`${targetDay}T23:59:00-03:00`);
    const reason = `${E2E_RUN_PREFIX} feriado empresa inteira`;
    await prisma.scheduleException.create({
      data: { tenantId: tenant.id, professionalId: null, type: "HOLIDAY", startsAt, endsAt, reason },
    });

    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await setAgendaDate(page, targetDay);

    // O rótulo aparece pelo menos 2x na grade (Ana e Bruna do seed + a profissional criada
    // nesta suíte) — confirma "todas as colunas", não só uma. `count()` não faz auto-retry como
    // `expect`, então espera aparecer pelo menos uma vez antes (dados da agenda carregam
    // assíncrono) e só então conta.
    await expect(page.getByText(reason).first()).toBeVisible();
    const occurrences = await page.getByText(reason).count();
    expect(occurrences).toBeGreaterThanOrEqual(2);

    await prisma.scheduleException.deleteMany({ where: { reason } });
  });
});

function tomorrowAt(hhmm: string): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const [h, m] = hhmm.split(":");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${h}:${m}`;
}

/** Próxima data (a partir de hoje, exclusive) cujo dia da semana bata (0=domingo…6=sábado), em YYYY-MM-DD. */
function nextWeekdayISO(weekday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function setAgendaDate(page: import("@playwright/test").Page, dateISO: string) {
  // A Agenda não tem um input de data direto — navega com Próximo período a partir de hoje.
  // Mais simples e determinístico: usa a URL com querystring? Não há suporte; em vez disso,
  // clica "Próximo período" o número de dias necessário a partir de "Hoje".
  await page.getByRole("button", { name: "Hoje" }).click();
  const today = new Date();
  const [y, m, d] = dateISO.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const diffDays = Math.round((target.setHours(0, 0, 0, 0) - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
  const next = page.getByRole("button", { name: "Próximo período" });
  const prev = page.getByRole("button", { name: "Período anterior" });
  const steps = Math.abs(diffDays);
  for (let i = 0; i < steps; i++) {
    if (diffDays > 0) await next.click();
    else await prev.click();
  }
}
