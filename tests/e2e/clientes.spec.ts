import { test, expect } from "@playwright/test";
import { SEED_TENANT_SLUG, E2E_RUN_PREFIX } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";
import { prisma } from "./fixtures/db";

/**
 * Clientes (`/clientes`, docs/plano-implementacao.md Etapa B1) — busca/filtros, criar (com
 * `CONTACT_EXISTS`), pausar/retomar bot, excluir (com e sem histórico) e exportar CSV com
 * neutralização de fórmula (revisão do Órion, `src/modules/contacts/contacts.ts#csvEscape`).
 */
test.use({ storageState: OWNER_STORAGE_STATE });

let phoneCounter = 0;
function uniquePhoneDigits(): string {
  // DDD 11 + 9 dígitos: 8 do timestamp do run + 1 contador (evita colisão entre execuções E
  // entre os vários clientes criados na MESMA execução).
  const suffix = E2E_RUN_PREFIX.replace(/\D/g, "").slice(-7).padStart(7, "7");
  phoneCounter += 1;
  return `119${suffix}${phoneCounter % 10}`;
}

/** Cria um cliente pelo diálogo e fecha o diálogo de DETALHE que abre sozinho em seguida
 * (`handleCreated` em `clientes-client.tsx` já deixa o cliente recém-criado aberto) — a maioria
 * dos testes quer voltar pra lista, não ficar no detalhe. */
async function createContactViaUI(page: import("@playwright/test").Page, name: string, phone: string) {
  await page.getByRole("button", { name: "Novo cliente" }).click();
  const formDialog = page.getByRole("dialog").filter({ hasText: "Novo cliente" });
  await formDialog.getByLabel("Nome", { exact: false }).fill(name);
  await formDialog.getByLabel("Telefone", { exact: false }).fill(phone);
  await formDialog.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(formDialog).toBeHidden();
  // O detalhe abre automaticamente — fecha pra voltar à lista.
  await expect(page.getByRole("dialog").filter({ hasText: "Dados, histórico de agendamentos" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
}

test.describe("Clientes", () => {
  // Contatos ANONIMIZADOS perdem o `name` (vira `null`) — não dá para limpar por
  // `contains: E2E_RUN_PREFIX` depois disso. Ids capturados explicitamente pelos testes que
  // anonimizam, para o `afterAll` conseguir apagar de qualquer jeito (deixa o banco de dev limpo).
  const anonymizedContactIds: string[] = [];

  test.afterAll(async () => {
    await prisma.contact.deleteMany({ where: { name: { contains: E2E_RUN_PREFIX } } });
    if (anonymizedContactIds.length) {
      await prisma.appointment.deleteMany({ where: { contactId: { in: anonymizedContactIds } } });
      await prisma.contact.deleteMany({ where: { id: { in: anonymizedContactIds } } });
    }
  });

  test("busca por nome e filtro 'Bot pausado' funcionam", async ({ page }) => {
    const name = `${E2E_RUN_PREFIX} Cliente Busca`;
    const phone = uniquePhoneDigits();
    await page.goto(`/${SEED_TENANT_SLUG}/clientes`);
    await createContactViaUI(page, name, phone);

    // Busca por um trecho do nome encontra o cliente recém-criado.
    await page.getByLabel("Buscar cliente por nome ou telefone").fill(name);
    await expect(page.getByText(name).first()).toBeVisible();

    // Filtro "Bot pausado" não mostra este cliente (bot não está pausado).
    await page.getByLabel("Buscar cliente por nome ou telefone").fill("");
    await page.getByRole("button", { name: "Bot pausado" }).click();
    await expect(page.getByText(name)).toHaveCount(0);

    await page.getByRole("button", { name: "Todos" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test("criar com telefone já cadastrado devolve CONTACT_EXISTS e permite abrir o existente", async ({ page }) => {
    const phone = uniquePhoneDigits();
    const firstName = `${E2E_RUN_PREFIX} Cliente Original`;
    const secondName = `${E2E_RUN_PREFIX} Cliente Duplicado`;

    await page.goto(`/${SEED_TENANT_SLUG}/clientes`);
    await createContactViaUI(page, firstName, phone);

    await page.getByRole("button", { name: "Novo cliente" }).click();
    const formDialog = page.getByRole("dialog").filter({ hasText: "Novo cliente" });
    await formDialog.getByLabel("Nome", { exact: false }).fill(secondName);
    await formDialog.getByLabel("Telefone", { exact: false }).fill(phone);
    await formDialog.getByRole("button", { name: "Criar", exact: true }).click();

    await expect(page.getByText("Já existe um cliente cadastrado com esse telefone.")).toBeVisible();
    await page.getByRole("button", { name: "Abrir cliente existente" }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "Dados, histórico de agendamentos" })).toBeVisible();
    await expect(page.getByText(firstName).first()).toBeVisible();
  });

  test("pausar e retomar o bot de um cliente", async ({ page }) => {
    const name = `${E2E_RUN_PREFIX} Cliente Pausa`;
    const phone = uniquePhoneDigits();
    await page.goto(`/${SEED_TENANT_SLUG}/clientes`);
    await createContactViaUI(page, name, phone);

    await page.getByText(name).first().click();
    await expect(page.getByRole("button", { name: "Pausar por 24h" })).toBeVisible();
    await page.getByRole("button", { name: "Pausar por 24h" }).click();
    await expect(page.getByText("Bot pausado para este cliente.").first()).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Bot pausado")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retomar bot" })).toBeVisible();

    await page.getByRole("button", { name: "Retomar bot" }).click();
    await expect(page.getByText("Bot retomado.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Pausar por 1h" })).toBeVisible();
  });

  test("excluir cliente sem histórico apaga de verdade", async ({ page }) => {
    const name = `${E2E_RUN_PREFIX} Cliente SemHistorico`;
    const phone = uniquePhoneDigits();
    await page.goto(`/${SEED_TENANT_SLUG}/clientes`);
    await createContactViaUI(page, name, phone);

    await page.getByText(name).first().click();
    await page.getByRole("button", { name: "Excluir cliente" }).click();
    await expect(page.getByRole("dialog").filter({ hasText: "Excluir cliente" })).toBeVisible();
    await page.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page.getByText("Cliente excluído.").first()).toBeVisible();

    const found = await prisma.contact.findFirst({ where: { name } });
    expect(found).toBeNull();
  });

  test("excluir cliente COM histórico anonimiza (mantém o agendamento, some o dado pessoal)", async ({ page }) => {
    const name = `${E2E_RUN_PREFIX} Cliente ComHistorico`;
    const phone = uniquePhoneDigits();
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });
    const bruna = await prisma.professional.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Bruna" } });
    const service = await prisma.service.findFirstOrThrow({ where: { tenantId: tenant.id, name: "Corte feminino" } });
    const contact = await prisma.contact.create({
      data: { tenantId: tenant.id, name, phoneE164: `+55${phone}`, waJid: `panel:${phone}@panel.local` },
    });
    // Bem longe no futuro numa profissional (Bruna) que outros specs desta suíte não costumam
    // reservar — evita esbarrar na constraint de exclusão `appointments_no_overlap_per_professional`
    // contra agendamentos de outros testes. Um offset FIXO ("+90 dias") colidia entre EXECUÇÕES
    // diferentes desta mesma suíte (o agendamento fica no banco de propósito — é o histórico sob
    // teste — então a próxima rodada criava outro quase no mesmo instante); o offset varia com o
    // timestamp do run (`E2E_RUN_PREFIX`) para nunca repetir o mesmo horário entre rodadas.
    const dayOffset = 90 + (Number(E2E_RUN_PREFIX.replace(/\D/g, "").slice(-5)) % 200);
    const startsAt = new Date(Date.now() + dayOffset * 86_400_000);
    await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        contactId: contact.id,
        professionalId: bruna.id,
        serviceId: service.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60_000),
        blockEndsAt: new Date(startsAt.getTime() + 70 * 60_000),
        status: "SCHEDULED",
        idempotencyKey: `e2e-anon-${phone}`,
      },
    });

    await page.goto(`/${SEED_TENANT_SLUG}/clientes`);
    await page.getByLabel("Buscar cliente por nome ou telefone").fill(name);
    await page.getByText(name).first().click();
    await page.getByRole("button", { name: "Excluir cliente" }).click();
    await page.getByRole("dialog").filter({ hasText: "Excluir cliente" }).getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(page.getByText("Cliente anonimizado.").first()).toBeVisible();

    anonymizedContactIds.push(contact.id);
    const anonymized = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(anonymized.name).toBeNull();
    expect(anonymized.phoneE164).toBeNull();
    const appt = await prisma.appointment.findFirst({ where: { contactId: contact.id } });
    expect(appt).not.toBeNull(); // histórico preservado
  });

  test("exportar CSV neutraliza fórmula no nome (proteção contra CSV injection)", async ({ page }) => {
    const dangerousName = `=HYPERLINK("http://evil.example","${E2E_RUN_PREFIX} clique")`;
    const phone = uniquePhoneDigits();
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });
    await prisma.contact.create({
      data: { tenantId: tenant.id, name: dangerousName, phoneE164: `+55${phone}`, waJid: `panel:${phone}@panel.local` },
    });

    await page.goto(`/${SEED_TENANT_SLUG}/clientes`);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Exportar CSV" }).click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(chunk as Buffer);
    const csv = Buffer.concat(chunks).toString("utf-8");

    // O campo vem entre aspas (tem vírgula/aspas internas) com o apóstrofo logo após a aspa de
    // abertura — `"'=HYPERLINK(...)"`. Não compara a string inteira (as aspas internas do nome
    // saem duplicadas pela regra do CSV, `""`), só confirma que o apóstrofo neutralizador está lá
    // e que a fórmula NUNCA aparece crua (sem apóstrofo/aspas na frente, que o Excel executaria).
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).not.toMatch(/[^'"]=HYPERLINK/);

    await prisma.contact.deleteMany({ where: { name: dangerousName } });
  });
});
