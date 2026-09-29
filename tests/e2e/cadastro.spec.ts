import { test, expect } from "@playwright/test";
import { prisma } from "./fixtures/db";
import { SEED_TENANT_SLUG, SEED_OWNER_EMAIL, E2E_RUN_PREFIX } from "./fixtures/test-data";
import { startFakeSmtpServer, extractFirstUrl } from "./fixtures/fake-smtp-server";

/**
 * `/cadastro` ponta a ponta (docs/contratos.md §7.3): slug reservado/duplicado → mensagem no
 * campo; sem SMTP configurado, o cadastro não pode quebrar (`sendMail` nunca lança —
 * `src/lib/email/mailer.ts`); com um SMTP fake local, valida o link de verificação de e-mail e o
 * "esqueci a senha" de ponta a ponta, capturando o e-mail de verdade (o token só existe em texto
 * puro dentro do link — o banco guarda só o hash, `AuthToken.tokenHash`).
 */

type SmtpSnapshot = {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean | null;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
};

async function readSmtpSnapshot(): Promise<SmtpSnapshot> {
  const settings = await prisma.platformSettings.findUniqueOrThrow({
    where: { id: 1 },
    select: { smtpHost: true, smtpPort: true, smtpSecure: true, smtpUser: true, smtpPassword: true, smtpFrom: true },
  });
  return settings;
}

async function writeSmtpSnapshot(snapshot: SmtpSnapshot): Promise<void> {
  await prisma.platformSettings.update({ where: { id: 1 }, data: snapshot });
}

// E-mail é normalizado para minúsculas no servidor (`src/modules/signup/service.ts:118`) antes de
// qualquer INSERT/lookup — `E2E_RUN_PREFIX` tem o marcador em MAIÚSCULAS (`E2E_TEST_DATA_...`),
// então usá-lo sem `.toLowerCase()` no local-part do e-mail grava um valor que nunca bate com o
// que a gente mesma consulta depois (mesmo achado documentado em `suspensao.spec.ts`).
const RUN_PREFIX_LC = E2E_RUN_PREFIX.toLowerCase();
// O campo de slug normaliza (`slugify`, `src/core/signup/slug.ts`) tirando underscore — um slug
// só aceita `[a-z0-9]+(-[a-z0-9]+)*`. Usar `RUN_PREFIX_LC` (com "_") para montar o slug esperado
// gravaria um valor que nunca bate com o que a tela realmente salva (achado ao rodar este teste:
// tenant "não encontrado" pela nossa query, mas existia — só que hifenizado).
const RUN_PREFIX_SLUG = RUN_PREFIX_LC.replace(/_/g, "-");

const CREATED_SLUGS: string[] = [];
const CREATED_EMAILS: string[] = [];

test.describe("Cadastro público (/cadastro) ponta a ponta", () => {
  let originalSmtp: SmtpSnapshot;

  test.beforeAll(async () => {
    originalSmtp = await readSmtpSnapshot();
  });

  test.afterAll(async () => {
    await writeSmtpSnapshot(originalSmtp);
    if (CREATED_SLUGS.length) await prisma.tenant.deleteMany({ where: { slug: { in: CREATED_SLUGS } } });
    if (CREATED_EMAILS.length) await prisma.user.deleteMany({ where: { email: { in: CREATED_EMAILS } } });
  });

  async function fillValidForm(page: import("@playwright/test").Page, opts: { slug: string; email: string }) {
    await page.goto("/cadastro");
    await page.getByLabel("Nome da empresa").fill(`${E2E_RUN_PREFIX} Empresa Cadastro`);
    await page.getByLabel("Endereço da empresa").fill(opts.slug);
    await page.getByLabel("Seu nome").fill("Dona da Empresa E2E");
    // CPF de teste com dígitos verificadores válidos (algoritmo público da Receita) — o campo
    // ficou obrigatório (docs/plano-implementacao.md Etapa A3), sem ele o formulário nunca
    // chega a submeter e todo o resto do teste falha em silêncio.
    await page.getByLabel("CPF ou CNPJ *", { exact: true }).fill("52998224725");
    await page.getByLabel("E-mail *", { exact: true }).fill(opts.email);
    await page.getByLabel("Senha *", { exact: true }).fill("senha-e2e-cadastro-2026");
    await page.getByLabel("Confirmar senha").fill("senha-e2e-cadastro-2026");
    await page.locator('input[type="checkbox"]').check();
  }

  test("CPF inválido (dígito verificador errado): mensagem no campo, nunca chama o servidor", async ({ page }) => {
    await fillValidForm(page, { slug: `${RUN_PREFIX_SLUG}-cpf-invalido`, email: `${RUN_PREFIX_LC}-cpf-invalido@e2e.innochat.local` });
    // Sobrescreve o CPF válido preenchido por `fillValidForm` com um dígito verificador errado
    // (mesma raiz, `529.982.247-XX` só que com o último dígito trocado).
    await page.getByLabel("CPF ou CNPJ *", { exact: true }).fill("52998224700");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Informe um CPF ou CNPJ válido.")).toBeVisible();
    // Nunca chegou a criar nada — nem tenant, nem usuário.
    const tenant = await prisma.tenant.findUnique({ where: { slug: `${RUN_PREFIX_SLUG}-cpf-invalido` } });
    expect(tenant).toBeNull();
  });

  test("CPF válido (com pontuação) é aceito e o cadastro segue normalmente", async ({ page }) => {
    const slug = `${RUN_PREFIX_SLUG}-cpf-valido`;
    const email = `${RUN_PREFIX_LC}-cpf-valido@e2e.innochat.local`;
    CREATED_SLUGS.push(slug);
    CREATED_EMAILS.push(email);
    await fillValidForm(page, { slug, email });
    // Mesmo CPF de `fillValidForm`, mas digitado com pontuação — `normalizeDocumentDigits`
    // (`src/core/billing/document.ts`) precisa aceitar igual.
    await page.getByLabel("CPF ou CNPJ *", { exact: true }).fill("529.982.247-25");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Confirme seu e-mail")).toBeVisible();
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    expect(tenant).not.toBeNull();
  });

  test("slug reservado: mensagem no campo, nunca chega a chamar o servidor", async ({ page }) => {
    await fillValidForm(page, { slug: "admin", email: `${RUN_PREFIX_LC}-reservado@e2e.innochat.local` });
    // `validateSlug` (puro, client-side) já bloqueia — nem precisa clicar em "Criar conta" para
    // ver o erro (mas clicamos, para confirmar que o submit não segue adiante).
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Esse endereço já é reservado pelo sistema. Escolha outro.")).toBeVisible();
    await expect(page.getByText("Confirme seu e-mail")).toHaveCount(0);
  });

  test("slug duplicado (empresa de seed): mensagem no campo", async ({ page }) => {
    const email = `${RUN_PREFIX_LC}-slugdup@e2e.innochat.local`;
    await fillValidForm(page, { slug: SEED_TENANT_SLUG, email });
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Esse endereço já está em uso. Escolha outro.")).toBeVisible();
  });

  test("e-mail duplicado (dono do seed): mensagem no campo", async ({ page }) => {
    const slug = `${RUN_PREFIX_SLUG}-cadastro-emaildup`;
    await fillValidForm(page, { slug, email: SEED_OWNER_EMAIL });
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Já existe uma conta com este e-mail.")).toBeVisible();
  });

  test("sem SMTP configurado, o cadastro conclui normalmente (e-mail de verificação só falha em silêncio)", async ({ page }) => {
    await writeSmtpSnapshot({ smtpHost: null, smtpPort: null, smtpSecure: null, smtpUser: null, smtpPassword: null, smtpFrom: null });

    const slug = `${RUN_PREFIX_SLUG}-cadastro-sem-smtp`;
    const email = `${RUN_PREFIX_LC}-sem-smtp@e2e.innochat.local`;
    CREATED_SLUGS.push(slug);
    CREATED_EMAILS.push(email);

    await fillValidForm(page, { slug, email });
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page.getByText("Confirme seu e-mail")).toBeVisible();
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    expect(tenant).not.toBeNull();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.emailVerifiedAt).toBeNull(); // ninguém confirmou nada — sem SMTP, sem e-mail enviado, e o cadastro segue de pé mesmo assim.
  });

  test("com SMTP fake: captura o e-mail de verificação, confirma pelo link; link do e-mail de redefinição de senha abre a página certa", async ({ page }) => {
    const fakeSmtp = await startFakeSmtpServer();
    const slug = `${RUN_PREFIX_SLUG}-cadastro-com-smtp`;
    const email = `${RUN_PREFIX_LC}-com-smtp@e2e.innochat.local`;
    CREATED_SLUGS.push(slug);
    CREATED_EMAILS.push(email);

    try {
      await writeSmtpSnapshot({
        smtpHost: "127.0.0.1",
        smtpPort: fakeSmtp.port,
        smtpSecure: false,
        smtpUser: null,
        smtpPassword: null,
        smtpFrom: "nao-responda@e2e.innochat.local",
      });

      await fillValidForm(page, { slug, email });
      await page.getByRole("button", { name: "Criar conta" }).click();
      await expect(page.getByText("Confirme seu e-mail")).toBeVisible();

      // Espera o e-mail de verificação chegar no SMTP fake (efeito colateral assíncrono, fora da
      // transação de cadastro — docs/contratos.md). O cadastro TAMBÉM dispara o e-mail de fatura
      // gerada (§7.1) — os dois chegam no mesmo fake SMTP, então procura especificamente o que
      // tem o link de verificação, em vez de assumir que é o primeiro capturado.
      await expect
        .poll(() => fakeSmtp.mails.some((m) => extractFirstUrl(m.data)?.includes("/verificar-email")), { timeout: 10_000 })
        .toBe(true);
      const verifyMail = fakeSmtp.mails.find((m) => extractFirstUrl(m.data)?.includes("/verificar-email"))!;
      expect(verifyMail.to[0]).toContain(email);
      const verifyUrl = extractFirstUrl(verifyMail.data);
      expect(verifyUrl).toBeTruthy();
      expect(verifyUrl).toContain("/verificar-email?token=");

      await page.goto(verifyUrl!);
      await expect(page.getByText("E-mail confirmado!")).toBeVisible();
      const verifiedUser = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(verifiedUser.emailVerifiedAt).not.toBeNull();

      // --- "Esqueci a senha" ---
      fakeSmtp.mails.length = 0;
      await page.goto("/recuperar-senha");
      await page.getByLabel("E-mail").fill(email);
      await page.getByRole("button", { name: "Enviar link" }).click();
      await expect(page.getByText("Verifique seu e-mail")).toBeVisible();

      await expect.poll(() => fakeSmtp.mails.length, { timeout: 10_000 }).toBeGreaterThan(0);
      const resetMail = fakeSmtp.mails[0];
      const resetUrl = extractFirstUrl(resetMail.data);
      expect(resetUrl).toBeTruthy();

      // Regressão: o link do e-mail apontava para "/recuperar-senha/confirmar" (rota inexistente,
      // 404). Agora o link real do e-mail precisa abrir a página que consome o token.
      expect(resetUrl).toContain("/redefinir-senha?token=");
      expect(new URL(resetUrl!).searchParams.get("token")).toBeTruthy();
      const linkResponse = await page.goto(resetUrl!);
      expect(linkResponse?.status()).toBe(200);
      await page.getByLabel("Nova senha *", { exact: true }).fill("senha-e2e-nova-2026");
      await page.getByLabel("Confirmar nova senha").fill("senha-e2e-nova-2026");
      await page.getByRole("button", { name: "Salvar nova senha" }).click();
      await expect(page).toHaveURL(/\/login\?redefinida=1/);

      // A senha nova de fato passa a valer.
      await page.getByLabel("E-mail").fill(email);
      await page.getByLabel("Senha").fill("senha-e2e-nova-2026");
      await page.getByRole("button", { name: "Entrar" }).click();
      await expect(page).toHaveURL(new RegExp(`/${slug}(/|$)`), { timeout: 10_000 });
    } finally {
      await fakeSmtp.close();
    }
  });
});
