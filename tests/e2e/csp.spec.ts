import { test, expect } from "@playwright/test";
import { login } from "./fixtures/auth";
import { SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD, SEED_TENANT_SLUG } from "./fixtures/test-data";
import { collectCspViolations } from "./fixtures/csp";
import { prisma } from "./fixtures/db";

/**
 * CSP nova (`next.config.ts`, revisão de segurança 2026-09-28): confirma que as telas de maior
 * risco de quebrar sob CSP real (inline styles, QR em `data:` URL, hidratação de Server
 * Components) não disparam NENHUMA violação no console do navegador — login, agenda, admin e
 * assinatura (QR do Pix). WhatsApp (QR da Evolution, também `data:`) é coberto em
 * `whatsapp.spec.ts`, que usa o mesmo helper `collectCspViolations`.
 */
test.describe("CSP (next.config.ts): nenhuma violação nas telas principais", () => {
  test("login: sem violação de CSP", async ({ page }) => {
    const { violations } = collectCspViolations(page);
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(SEED_OWNER_EMAIL);
    await page.getByLabel("Senha").fill(SEED_OWNER_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/(studio-demo|admin)/);
    expect(violations).toEqual([]);
  });

  test("Agenda (dia e semana): sem violação de CSP", async ({ page }) => {
    const { violations } = collectCspViolations(page);
    await login(page, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    await page.waitForURL(/\/(studio-demo|admin)/);
    await page.goto(`/${SEED_TENANT_SLUG}/agenda`);
    await page.getByRole("button", { name: "Semana" }).click();
    await page.waitForTimeout(500); // dá tempo de qualquer violação assíncrona (ex.: CSS-in-JS) aparecer
    expect(violations).toEqual([]);
  });

  test("Admin → Configurações: sem violação de CSP", async ({ page }) => {
    const { violations } = collectCspViolations(page);
    await login(page, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
    await page.waitForURL(/\/(studio-demo|admin)/);
    await page.goto("/admin/configuracoes");
    await page.waitForTimeout(500);
    expect(violations).toEqual([]);
  });

  test("Assinatura com QR do Pix (data: URL): sem violação de CSP", async ({ page }) => {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    // Fatura OPEN com Pix já gerado — sem isso a tela não chega a montar o `<img>` do QR (data:
    // URL, o ponto que a CSP nova mais arrisca quebrar: `img-src` precisa listar `data:`).
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amountCents: 1000,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * 86_400_000),
        dueAt: new Date(Date.now() + 5 * 86_400_000),
        status: "OPEN",
        pixCopyPaste: "00020126580014BR.GOV.BCB.PIX0136e2e-test-fake-pix-copia-e-cola-csp-5204000053039865802BR5913InnoChat E2E6008BRASILIA62070503***6304ABCD",
        pixExpiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    try {
      const { violations } = collectCspViolations(page);
      await login(page, SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD);
      await page.waitForURL(/\/(studio-demo|admin)/);
      await page.goto(`/${SEED_TENANT_SLUG}/assinatura`);
      // Espera o `<img>` do QR (gerado client-side via `qrcode`, `QRCode.toDataURL`) aparecer.
      await expect(page.getByAltText("QR code Pix para pagamento da fatura")).toBeVisible({ timeout: 10_000 });
      const src = await page.getByAltText("QR code Pix para pagamento da fatura").getAttribute("src");
      expect(src).toMatch(/^data:image\//);
      await page.waitForTimeout(500);
      expect(violations).toEqual([]);
    } finally {
      await prisma.invoice.delete({ where: { id: invoice.id } });
    }
  });
});
