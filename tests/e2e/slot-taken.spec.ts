import { test, expect, type Browser } from "@playwright/test";
import { login } from "./fixtures/auth";
import { SEED_TENANT_SLUG, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD, E2E_RUN_PREFIX } from "./fixtures/test-data";

/**
 * docs/contratos.md Fase 2/4: "dois contextos tentando o mesmo horário → um recebe a mensagem
 * amigável" (`SLOT_TAKEN`). Dois browser contexts (duas "abas" independentes, cada uma com sua
 * própria sessão) abrem o MESMO slot livre e enviam quase ao mesmo tempo — a constraint EXCLUDE
 * do banco garante exatamente 1 sucesso; o outro precisa ver a mensagem amigável, nunca um erro
 * cru ou uma tela quebrada.
 */
test("dois contextos disputando o mesmo horário: um agenda, o outro vê a mensagem amigável de SLOT_TAKEN", async ({ browser }: { browser: Browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await login(pageA, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
  await login(pageB, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
  await pageA.waitForURL(new RegExp(`/${SEED_TENANT_SLUG}(/|$)`));
  await pageB.waitForURL(new RegExp(`/${SEED_TENANT_SLUG}(/|$)`));

  const bookableDay = nextWeekdayISO(4); // quinta — expediente normal, slot ainda não usado por outra spec
  await pageA.goto(`/${SEED_TENANT_SLUG}/agenda`);
  await pageB.goto(`/${SEED_TENANT_SLUG}/agenda`);
  await setAgendaDate(pageA, bookableDay);
  await setAgendaDate(pageB, bookableDay);

  const slotButton = /Novo agendamento com Ana às 11:00/;
  await pageA.getByRole("button", { name: slotButton }).click();
  await pageB.getByRole("button", { name: slotButton }).click();

  // Serviço explícito (não confia no default do dialog — pode ser qualquer serviço ativo por
  // `sortOrder`, e nem todo serviço é feito pela Ana) — "Corte feminino" é do seed, sempre existe.
  await pageA.getByLabel("Serviço").selectOption({ label: "Corte feminino (60 min)" });
  await pageB.getByLabel("Serviço").selectOption({ label: "Corte feminino (60 min)" });

  await pageA.getByRole("dialog").getByLabel("Nome do cliente").fill(`${E2E_RUN_PREFIX} Corrida A`);
  await pageB.getByRole("dialog").getByLabel("Nome do cliente").fill(`${E2E_RUN_PREFIX} Corrida B`);

  const [resultA, resultB] = await Promise.allSettled([
    pageA.getByRole("button", { name: "Agendar", exact: true }).click(),
    pageB.getByRole("button", { name: "Agendar", exact: true }).click(),
  ]);
  expect(resultA.status).toBe("fulfilled");
  expect(resultB.status).toBe("fulfilled");

  // Uma das duas telas fecha o dialog (sucesso); a outra mostra a mensagem amigável de SLOT_TAKEN
  // e continua com o dialog aberto para escolher outro horário — nunca uma tela de erro genérica.
  const friendlyMessage = "Esse horário acabou de ser ocupado. Escolha outro.";
  await Promise.race([
    expect(pageA.getByText(friendlyMessage)).toBeVisible({ timeout: 10_000 }),
    expect(pageB.getByText(friendlyMessage)).toBeVisible({ timeout: 10_000 }),
  ]);

  const aShowsError = await pageA.getByText(friendlyMessage).isVisible();
  const bShowsError = await pageB.getByText(friendlyMessage).isVisible();
  expect(aShowsError !== bShowsError).toBe(true); // exatamente UMA das duas viu o erro

  const winnerPage = aShowsError ? pageB : pageA;
  const winnerName = aShowsError ? `${E2E_RUN_PREFIX} Corrida B` : `${E2E_RUN_PREFIX} Corrida A`;
  await expect(winnerPage.getByRole("dialog")).toBeHidden();
  await expect(winnerPage.getByText(winnerName).first()).toBeVisible();

  await contextA.close();
  await contextB.close();
});

function nextWeekdayISO(weekday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== weekday) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function setAgendaDate(page: import("@playwright/test").Page, dateISO: string) {
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
