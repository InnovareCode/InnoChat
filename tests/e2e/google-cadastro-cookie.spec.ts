import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/**
 * S1 (revisão do Órion): o token de `/cadastro/google?t=...` só abre no navegador que tem o cookie
 * httpOnly com o hash dele. Não há Google real aqui: o token é assinado com a mesma fórmula de
 * `src/modules/google-auth/tokens.ts` (HMAC com chave derivada do AUTH_SECRET, lido do .env sem
 * imprimir) e o cookie é posto pelo teste — o que o callback do Auth.js faria.
 */

function authSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const m = readFileSync(".env", "utf8").match(/^AUTH_SECRET\s*=\s*"?([^"\r\n]+)"?/m);
  if (!m) throw new Error("AUTH_SECRET não encontrado");
  return m[1]!;
}

function signSignupToken(email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = { email, name: "Teste Cookie", sub: `sub-e2e-${randomBytes(6).toString("hex")}`, purpose: "google-signup", jti: randomBytes(8).toString("base64url"), iat: now, exp: now + 600 };
  const body = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const key = createHash("sha256").update(`innochat:google-auth:google-signup:${authSecret()}`).digest();
  return `${body}.${createHmac("sha256", key).update(body).digest("base64url")}`;
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

test.describe("cadastro com Google: token amarrado ao navegador por cookie", () => {
  test("token na URL SEM o cookie é recusado", async ({ page }) => {
    const token = signSignupToken(`e2e-cookie-a-${Date.now()}@example.com`);
    await page.goto(`/cadastro/google?t=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: "Esse link não é válido" })).toBeVisible();
  });

  test("cookie de OUTRO token é recusado", async ({ page, baseURL }) => {
    const token = signSignupToken(`e2e-cookie-b-${Date.now()}@example.com`);
    await page.context().addCookies([{ name: "innochat_google_signup", value: hash("outro-token"), url: baseURL! }]);
    await page.goto(`/cadastro/google?t=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: "Esse link não é válido" })).toBeVisible();
  });

  test("token + cookie do mesmo navegador abre o formulário, com o e-mail do Google", async ({ page, baseURL }) => {
    const email = `e2e-cookie-c-${Date.now()}@example.com`;
    const token = signSignupToken(email);
    await page.context().addCookies([{ name: "innochat_google_signup", value: hash(token), url: baseURL! }]);
    await page.goto(`/cadastro/google?t=${encodeURIComponent(token)}`);
    await expect(page.getByRole("heading", { name: "Esse link não é válido" })).toHaveCount(0);
    await expect(page.locator("#google-email")).toHaveValue(email);
  });
});
