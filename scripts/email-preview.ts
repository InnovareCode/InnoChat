/**
 * Preview dos e-mails transacionais: gera `docs/design/emails/*.html` com dados de exemplo e,
 * com `--shots`, prints PNG (Playwright) em 600px, 375px e dark mode simulado
 * (`prefers-color-scheme: dark` — cobre Apple Mail/iOS/Outlook.com; a inversão automática do
 * Gmail NÃO é reproduzível aqui) em `docs/design/screens/premium/emails/`.
 *
 * Uso: `npx tsx scripts/email-preview.ts [--shots]`
 * As imagens `/marca/*` apontam para `public/marca` por caminho relativo, então o HTML abre
 * direto do disco (em produção a URL é absoluta: `<publicBaseUrl>/marca/...`).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { EmailContext } from "../src/lib/email/layout";
import {
  invoiceDueReminderEmail,
  invoiceGeneratedEmail,
  passwordResetEmail,
  paymentConfirmedEmail,
  subscriptionSuspendedEmail,
  teamInviteEmail,
  verificationEmail,
} from "../src/lib/email/templates";

const ROOT = path.resolve(__dirname, "..");
const OUT_HTML = path.join(ROOT, "docs/design/emails");
const OUT_SHOTS = path.join(ROOT, "docs/design/screens/premium/emails");

const FAKE_BASE = "https://preview.invalid";
const ctx: EmailContext = {
  baseUrl: FAKE_BASE,
  legal: { companyLegalName: "Innovare Code Tecnologia LTDA", companyCnpj: "00.000.000/0001-00" },
};
const BASE = "https://painel.innochat.exemplo.com.br";
const PIX =
  "00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540599.905802BR5913STUDIO BELA LT6009SAO PAULO62070503***63041D3F";

const emails = {
  "verificacao": verificationEmail({ verifyUrl: `${BASE}/verificar-email?token=abc123`, ctx }),
  "redefinir-senha": passwordResetEmail({ resetUrl: `${BASE}/redefinir-senha?token=abc123`, ctx }),
  "convite-equipe": teamInviteEmail({ tenantName: "Studio Bela Vista", inviteUrl: `${BASE}/convite?token=abc123`, ctx }),
  "fatura-gerada": invoiceGeneratedEmail({ tenantName: "Studio Bela Vista", amountReais: "R$ 99,90", dueDateBr: "06/10/2026", pixCopyPaste: PIX, billingUrl: `${BASE}/studio-bela/assinatura`, ctx }),
  "fatura-vence-amanha": invoiceDueReminderEmail({ tenantName: "Studio Bela Vista", amountReais: "R$ 99,90", dueDateBr: "06/10/2026", billingUrl: `${BASE}/studio-bela/assinatura`, dueToday: false, ctx }),
  "fatura-vence-hoje": invoiceDueReminderEmail({ tenantName: "Studio Bela Vista", amountReais: "R$ 99,90", dueDateBr: "06/10/2026", billingUrl: `${BASE}/studio-bela/assinatura`, dueToday: true, ctx }),
  "assinatura-suspensa": subscriptionSuspendedEmail({ tenantName: "Studio Bela Vista", billingUrl: `${BASE}/studio-bela/assinatura`, ctx }),
  "teste-terminou": subscriptionSuspendedEmail({ tenantName: "Studio Bela Vista", billingUrl: `${BASE}/studio-bela/assinatura`, trialNotConverted: true, cancelInDays: 60, ctx }),
  "pagamento-confirmado": paymentConfirmedEmail({ tenantName: "Studio Bela Vista", amountReais: "R$ 99,90", paidDateBr: "29/09/2026", activeUntilBr: "29/10/2026", billingUrl: `${BASE}/studio-bela/assinatura`, ctx }),
};

mkdirSync(OUT_HTML, { recursive: true });
const files: Array<{ name: string; file: string }> = [];
for (const [name, mail] of Object.entries(emails)) {
  const html = mail.html.replaceAll(`${FAKE_BASE}/marca/`, "../../../public/marca/");
  const file = path.join(OUT_HTML, `${name}.html`);
  writeFileSync(file, html, "utf8");
  files.push({ name, file });
}
console.log(`${files.length} HTMLs em ${path.relative(ROOT, OUT_HTML)}`);

async function shots() {
  const { chromium } = await import("@playwright/test");
  mkdirSync(OUT_SHOTS, { recursive: true });
  const browser = await chromium.launch();
  const variants = [
    { suffix: "600", width: 600, scheme: "light" as const },
    { suffix: "375", width: 375, scheme: "light" as const },
    { suffix: "dark-600", width: 600, scheme: "dark" as const },
    { suffix: "dark-375", width: 375, scheme: "dark" as const },
  ];
  for (const v of variants) {
    const context = await browser.newContext({ viewport: { width: v.width, height: 800 }, colorScheme: v.scheme, deviceScaleFactor: 1 });
    const page = await context.newPage();
    for (const { name, file } of files) {
      await page.goto(pathToFileURL(file).href);
      await page.screenshot({ path: path.join(OUT_SHOTS, `${name}-${v.suffix}.png`), fullPage: true });
    }
    await context.close();
  }
  await browser.close();
  console.log(`prints em ${path.relative(ROOT, OUT_SHOTS)}`);
}

if (process.argv.includes("--shots")) {
  shots().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
