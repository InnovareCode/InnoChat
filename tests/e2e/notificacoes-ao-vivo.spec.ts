import { test, expect } from "@playwright/test";
import { SEED_TENANT_SLUG, E2E_RUN_PREFIX } from "./fixtures/test-data";
import { OWNER_STORAGE_STATE } from "./fixtures/storage-state";
import { prisma } from "./fixtures/db";

/**
 * Notificações e "atualizar sozinho" (sem F5). O agendamento é criado direto no banco — o mesmo
 * efeito de o cliente marcar pelo WhatsApp (linha em `appointments` + evento CREATED do CONTATO) —
 * enquanto a Agenda já está aberta; ele precisa aparecer sem recarregar a página, no ciclo de
 * polling da tela de agenda (15 s). O marcador em `window` prova que NÃO houve reload.
 */
test.use({ storageState: OWNER_STORAGE_STATE });
test.setTimeout(75_000);

async function createWhatsappBooking(contactName: string): Promise<string> {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });
  const service = await prisma.service.findFirstOrThrow({ where: { tenantId: tenant.id } });
  const professionals = await prisma.professional.findMany({ where: { tenantId: tenant.id, name: { in: ["Ana", "Bruna"] } } });
  const contact = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      name: contactName,
      waJid: `e2e-live-${Date.now()}@s.whatsapp.net`,
      phoneE164: `+5500000${String(Date.now()).slice(-6)}`,
    },
  });
  // Procura um horário livre hoje (o EXCLUDE do banco recusa sobreposição por profissional).
  for (let offsetMin = 45; offsetMin < 6 * 60; offsetMin += 30) {
    for (const professional of professionals) {
      const startsAt = new Date(Date.now() + offsetMin * 60_000);
      const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
      try {
        const appointment = await prisma.appointment.create({
          data: {
            tenantId: tenant.id,
            contactId: contact.id,
            serviceId: service.id,
            professionalId: professional.id,
            startsAt,
            endsAt,
            blockEndsAt: endsAt,
            source: "WHATSAPP",
          },
        });
        await prisma.appointmentEvent.create({
          data: { appointmentId: appointment.id, action: "CREATED", authorType: "CONTACT" },
        });
        return appointment.id;
      } catch {
        // conflito de horário: tenta o próximo
      }
    }
  }
  throw new Error("Sem horário livre para o teste ao vivo.");
}

test.describe("notificações ao vivo", () => {
  test("agendamento criado pelo WhatsApp aparece na Agenda sem recarregar (<= ~15 s)", async ({ page }) => {
    test.skip(new Date().getHours() >= 19, "Horário livre de hoje pode cruzar a meia-noite.");
    const name = `${E2E_RUN_PREFIX} Cliente Ao Vivo`;

    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await expect(page.getByRole("button", { name: /^Notificações/ })).toBeVisible();
    await page.evaluate(() => {
      (window as unknown as { __semReload: string }).__semReload = "mesma-pagina";
    });

    const started = Date.now();
    await createWhatsappBooking(name);

    await expect(page.locator("button", { hasText: name }).first()).toBeVisible({ timeout: 30_000 });
    expect(Date.now() - started).toBeLessThan(30_000);

    const marker = await page.evaluate(() => (window as unknown as { __semReload?: string }).__semReload);
    expect(marker).toBe("mesma-pagina");
  });

  test("sino abre com foco no painel, Esc fecha e devolve o foco ao botão", async ({ page }) => {
    await page.goto(`/${SEED_TENANT_SLUG}/inicio`);
    const bell = page.getByRole("button", { name: /^Notificações/ });
    await bell.click();
    const panel = page.getByRole("dialog", { name: "Notificações" });
    await expect(panel).toBeVisible();
    await expect(page.getByRole("button", { name: "Todas", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(bell).toBeFocused();
  });
});
