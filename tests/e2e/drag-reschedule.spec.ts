import { test, expect, type Page, type Locator } from "@playwright/test";
import { SEED_TENANT_SLUG, E2E_RUN_PREFIX } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";
import { prisma } from "./fixtures/db";

/**
 * Arrastar para remarcar (docs premium, pacote "agenda interativa" — `@dnd-kit`, ver o comentário
 * de `handleReschedule` em `agenda-client.tsx`). Simula o arraste com `page.mouse` (dnd-kit usa
 * `PointerSensor` com `activationConstraint: { distance: 8 }` — precisa de um movimento inicial
 * antes de "pegar" o card) em vez de `dragTo` do Playwright, que não dispara os eventos de
 * pointer que o dnd-kit escuta.
 *
 * O teste de sucesso NÃO afirma o slot exato de destino: a colisão do dnd-kit (`rectIntersection`
 * sobre o retângulo arrastado, não o ponteiro) pode resolver para a célula vizinha da mirada
 * quando o cartão arrastado cobre mais de uma linha de 30min (achado ao rodar este teste pela
 * primeira vez — um agendamento de 60min "mirando" 11:00 pousou em 10:30). Testar "remarcou de
 * verdade, saiu de onde estava" já prova o contrato; testar o pixel exato seria testar o algoritmo
 * de colisão de uma lib de terceiros, não o produto.
 */
test.use({ storageState: OWNER_STORAGE_STATE });

const CLIENT_NAME = `${E2E_RUN_PREFIX} Cliente Arraste`;
const ROW_HEIGHT_PX = 48;

// Mesma convenção de `catalog-and-agenda.spec.ts` (Date local — o host deste projeto roda em
// America/Sao_Paulo, igual ao fuso do tenant de seed, então local == fuso do tenant).
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
  for (let i = 0; i < Math.abs(diffDays); i++) {
    if (diffDays > 0) await next.click();
    else await prev.click();
  }
}

async function bookAt(page: Page, professional: "Ana" | "Bruna", timeLabel: string, clientName: string) {
  await page.getByRole("button", { name: new RegExp(`Novo agendamento com ${professional} às ${timeLabel}`) }).click();
  await page.getByLabel("Serviço").selectOption({ label: "Corte feminino (60 min)" });
  await page.getByRole("dialog").getByLabel("Nome do cliente").fill(clientName);
  await page.getByRole("button", { name: "Agendar", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

/** Arrasta `card` até `target`, rolando a grade (que rola por DENTRO — `overflow-auto`) para os
 * dois ficarem visíveis antes de calcular as coordenadas de mouse. */
async function dragCardTo(page: Page, card: Locator, target: Locator, opts: { untilOver?: Locator } = {}) {
  await target.scrollIntoViewIfNeeded();
  const from = await card.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("bounding box ausente — elemento não está na tela");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Passo intermediário pequeno primeiro (supera o `activationConstraint.distance: 8` do
  // PointerSensor sem já sair de cima do card, senão o dnd-kit nunca registra a ativação).
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  // Soltar antes de o dnd-kit registrar a última colisão (`isOver` -> `bg-primary/15` no slot)
  // faz o `over` ficar num slot do caminho (ou nulo) — flaky ~30% no teste "outra profissional".
  // Quando o teste sabe qual coluna é o alvo, espera o destaque aparecer antes do mouse.up.
  if (opts.untilOver) await expect(opts.untilOver.first()).toBeVisible();
  await page.mouse.up();
}

test.describe("Arrastar para remarcar (Agenda, visão Dia)", () => {
  const bookableDay = nextWeekdayISO(2); // terça — expediente normal de Ana e Bruna no seed

  test.afterEach(async () => {
    await prisma.contact.deleteMany({ where: { name: { contains: CLIENT_NAME } } });
  });

  test("arrasta para um horário livre da MESMA profissional: remarca de verdade (sai de onde estava)", async ({ page }) => {
    const name = `${CLIENT_NAME} Sucesso`;
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await setAgendaDate(page, bookableDay);
    await bookAt(page, "Ana", "10:00", name);
    const contactBefore = await prisma.contact.findFirstOrThrow({ where: { name } });
    const apptBefore = await prisma.appointment.findFirstOrThrow({ where: { contactId: contactBefore.id } });

    const card = page.getByRole("button").filter({ hasText: name });
    await expect(card).toBeVisible();
    const target = page.getByRole("button", { name: /Novo agendamento com Ana às 11:30/ });
    await dragCardTo(page, card, target);

    await expect(page.getByText("Agendamento remarcado").first()).toBeVisible();
    // Não afirma o slot exato de pouso (ver comentário no topo do arquivo) — só que SAIU do
    // horário original (banco, fonte de verdade) e continua existindo em algum lugar da coluna
    // de Ana.
    await expect(page.getByRole("button", { name: /Novo agendamento com Ana às 10:00/ })).toBeVisible();
    await expect(card).toBeVisible();
    const apptAfter = await prisma.appointment.findUniqueOrThrow({ where: { id: apptBefore.id } });
    expect(apptAfter.startsAt.toISOString()).not.toBe(apptBefore.startsAt.toISOString());
    expect(apptAfter.professionalId).toBe(apptBefore.professionalId);
  });

  test("soltar num bloqueio da mesma profissional não remarca (reverte, sem erro)", async ({ page }) => {
    const name = `${CLIENT_NAME} Bloqueio`;
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });
    const ana = await prisma.professional.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Ana" } });
    const reason = `${E2E_RUN_PREFIX} bloqueio para teste de arraste`;
    // Bloqueio largo (16:00–17:30, longe do agendamento de demonstração do seed às 13:00): a
    // colisão do dnd-kit some sobre o retângulo ARRASTADO (2 linhas de 30min, já que o serviço
    // dura 60min) — mirar bem no meio de uma janela larga garante que, mesmo com ±1 linha de
    // imprecisão (ver comentário no topo do arquivo), o resultado da colisão sempre cai numa
    // célula desabilitada, sem esbarrar em outro agendamento já existente.
    const startsAt = new Date(`${bookableDay}T16:00:00-03:00`);
    const endsAt = new Date(`${bookableDay}T17:30:00-03:00`);
    await prisma.scheduleException.create({
      data: { tenantId: tenant.id, professionalId: ana.id, type: "BLOCK", startsAt, endsAt, reason },
    });

    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await setAgendaDate(page, bookableDay);
    await bookAt(page, "Ana", "10:00", name);

    const contactBefore = await prisma.contact.findFirstOrThrow({ where: { name } });
    const apptBefore = await prisma.appointment.findFirstOrThrow({ where: { contactId: contactBefore.id } });

    const card = page.getByRole("button").filter({ hasText: name });
    await expect(card).toBeVisible();
    // A célula do bloqueio (16:00–17:30) existe (droppable) mas fica `disabled` — o dnd-kit nunca
    // registra um `over` válido ali, então `handleDragEnd` não chama o servidor.
    const blockedSlot = page.getByRole("button", { name: /Novo agendamento com Ana às 16:30/ });
    await dragCardTo(page, card, blockedSlot);

    // Sem toast de sucesso, e o horário no BANCO não mudou (fonte de verdade — o DOM sozinho é
    // frágil aqui: a grade rola por dentro e o card pode estar fora da área visível sem que isso
    // signifique que ele se moveu).
    await expect(page.getByText("Agendamento remarcado")).toHaveCount(0);
    const apptAfter = await prisma.appointment.findUniqueOrThrow({ where: { id: apptBefore.id } });
    expect(apptAfter.startsAt.toISOString()).toBe(apptBefore.startsAt.toISOString());

    await prisma.scheduleException.deleteMany({ where: { reason } });
  });

  test("soltar fora do expediente (antes de abrir) não remarca (reverte, sem erro)", async ({ page }) => {
    const name = `${CLIENT_NAME} ForaExpediente`;
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await setAgendaDate(page, bookableDay);
    await bookAt(page, "Ana", "10:00", name);

    const contactBefore = await prisma.contact.findFirstOrThrow({ where: { name } });
    const apptBefore = await prisma.appointment.findFirstOrThrow({ where: { contactId: contactBefore.id } });

    const card = page.getByRole("button").filter({ hasText: name });
    await expect(card).toBeVisible();
    const anchor = page.getByRole("button", { name: /Novo agendamento com Ana às 09:00/ });
    await anchor.scrollIntoViewIfNeeded();
    // Garante que o topo da grade (07:00, fora do expediente) também está visível — o alvo desta
    // rolagem fica ACIMA das 09:00.
    await anchor.evaluate((el) => el.closest(".overflow-auto")?.scrollTo({ top: 0 }));
    const anchorBox = await anchor.boundingBox();
    if (!anchorBox) throw new Error("slot de referência (09:00) não encontrado");
    // Duas linhas antes das 09:00 (fora do expediente de Ana, ter–sáb 09:00–18:00) — região sem
    // droppable (nem `id`, `aria-hidden="true"` no código-fonte), só dá pra alcançar por pixel.
    const outOfHoursTarget = { x: anchorBox.x + anchorBox.width / 2, y: anchorBox.y - 2 * ROW_HEIGHT_PX + anchorBox.height / 2 };

    const from = await card.boundingBox();
    if (!from) throw new Error("cartão do agendamento não encontrado");
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2 + 12, { steps: 5 });
    await page.mouse.move(outOfHoursTarget.x, outOfHoursTarget.y, { steps: 12 });
    await page.mouse.up();

    await expect(page.getByText("Agendamento remarcado")).toHaveCount(0);
    const apptAfter = await prisma.appointment.findUniqueOrThrow({ where: { id: apptBefore.id } });
    expect(apptAfter.startsAt.toISOString()).toBe(apptBefore.startsAt.toISOString());
  });

  test("soltar na coluna de OUTRA profissional avisa e não troca de profissional", async ({ page }) => {
    const name = `${CLIENT_NAME} OutraProfissional`;
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await setAgendaDate(page, bookableDay);
    await bookAt(page, "Ana", "10:00", name);

    const contactBefore = await prisma.contact.findFirstOrThrow({ where: { name } });
    const apptBefore = await prisma.appointment.findFirstOrThrow({ where: { contactId: contactBefore.id } });

    const card = page.getByRole("button").filter({ hasText: name });
    await expect(card).toBeVisible();
    const brunaSlot = page.getByRole("button", { name: /Novo agendamento com Bruna às 10:00/ });
    const brunaSlotUnderDrag = page.getByRole("button", { name: /Novo agendamento com Bruna/ }).and(page.locator('[class*="bg-primary/15"]'));
    await dragCardTo(page, card, brunaSlot, { untilOver: brunaSlotUnderDrag });

    await expect(page.getByText("Não é possível mudar de profissional arrastando").first()).toBeVisible();
    // Continua com Ana, no mesmo horário (fonte de verdade: banco) — e o slot da Bruna às 10:00
    // continua livre (não "roubado" pelo agendamento da Ana).
    await expect(brunaSlot).toBeVisible();
    const apptAfter = await prisma.appointment.findUniqueOrThrow({ where: { id: apptBefore.id } });
    expect(apptAfter.professionalId).toBe(apptBefore.professionalId);
    expect(apptAfter.startsAt.toISOString()).toBe(apptBefore.startsAt.toISOString());
  });
});
