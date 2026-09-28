import { test, expect } from "@playwright/test";
import { spawn, execSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { deriveTestDatabaseUrl } from "./fixtures/test-db-url";

/**
 * `/instalacao` (docs/contratos.md — "Instalação única do primeiro admin"): banco sem admin →
 * código errado → erro; código certo → cria admin → redireciona ao login com aviso; depois a
 * rota dá 404.
 *
 * **Nunca contra o banco de DEV** (`innochat`, com o admin de seed `dev@innochat.local` já
 * instalado — testar isso lá exigiria apagar esse admin, proibido pela missão). Sobe um `next
 * dev` PRÓPRIO, numa porta separada (3101), com `DATABASE_URL` apontando para `innochat_test`
 * (mesmo banco usado por `npm run test:integration`, migrations já aplicadas — ver
 * `.claude/agent-memory/vega/integration_tests_setup.md`). Isolado do `playwright.config.ts`
 * principal: este arquivo gerencia seu próprio processo de servidor via `beforeAll`/`afterAll`,
 * sem tocar no `webServer` compartilhado (que continua servindo a porta 3000 para todo o resto
 * da suíte, contra `innochat`).
 *
 * Antes de começar E ao terminar, garante que `innochat_test` não tem NENHUM admin instalado —
 * idempotente entre execuções (deleta qualquer `PlatformInstallCode`/admin remanescente de uma
 * rodada anterior interrompida). Isso é seguro porque `innochat_test` é EXCLUSIVAMENTE um banco
 * de teste, nunca o de dev/produção.
 */

const PORT = 3101;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_BOOT_TIMEOUT_MS = 90_000;

let serverProcess: ChildProcessWithoutNullStreams | null = null;
let installCode = "";
let prisma: PrismaClient;
let createdAdminEmail: string | null = null;

async function waitForServerReady(): Promise<void> {
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/login`);
      if (res.status < 500) return;
    } catch {
      // ainda não está de pé — tenta de novo.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Servidor de /instalacao (porta 3101) não respondeu a tempo.");
}

test.describe.serial("/instalacao — bootstrap do primeiro admin da plataforma", () => {
  test.beforeAll(async () => {
    test.setTimeout(SERVER_BOOT_TIMEOUT_MS + 30_000);

    const testDatabaseUrl = deriveTestDatabaseUrl();
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });

    // Reset idempotente: innochat_test nunca deve ter um admin "esquecido" de uma rodada
    // anterior interrompida antes do afterAll rodar.
    await prisma.user.deleteMany({ where: { isPlatformAdmin: true, email: { contains: "e2e-instalacao" } } });
    await prisma.platformInstallCode.deleteMany({});

    // Roda o binário local direto (`node_modules/.bin/next`), nunca `npx next` — `npx` resolve o
    // pacote via npm a cada chamada (checagem de registro/rede), o que pode estourar o timeout de
    // boot sem relação nenhuma com o Next em si (achado ao rodar este teste).
    const nextBin = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
    let stdoutBuffer = "";
    serverProcess = spawn(nextBin, ["dev", "-p", String(PORT)], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: testDatabaseUrl, PORT: String(PORT) },
      shell: process.platform === "win32",
    });

    serverProcess.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString("utf-8");
    });
    let stderrBuffer = "";
    serverProcess.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString("utf-8");
    });
    serverProcess.on("error", (err) => {
      stderrBuffer += `\n[spawn error] ${err.message}`;
    });
    let exitInfo = "";
    serverProcess.on("exit", (code, signal) => {
      exitInfo = `exited early: code=${code} signal=${signal}`;
    });

    try {
      await waitForServerReady();
    } catch (err) {
      throw new Error(`${(err as Error).message}\n${exitInfo}\nstderr:\n${stderrBuffer}\nstdout:\n${stdoutBuffer}`);
    }

    // O código de instalação é impresso UMA VEZ no boot (`bootstrapInstallCodeIfNeeded`) — se o
    // servidor já estava de pé (não é o caso aqui, processo novo) ou o boot foi mais rápido que
    // a leitura do stdout, poll o buffer por alguns segundos.
    const codeDeadline = Date.now() + 15_000;
    while (Date.now() < codeDeadline) {
      const match = stdoutBuffer.match(/código de instalação = (\S+)/);
      if (match) {
        installCode = match[1];
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!installCode) throw new Error("Código de instalação não apareceu no log do servidor de teste.");
  });

  test.afterAll(async () => {
    // `npx next dev` no Windows sobe via `cmd`/`node` intermediário (`shell: true`) — matar só o
    // PID do processo raiz deixa o `next-server` (grandchild) vivo, ocupando a porta 3101 para
    // sempre. `taskkill /t` mata a árvore inteira; em outros SOs, `kill()` no processo já basta.
    if (serverProcess?.pid) {
      if (process.platform === "win32") {
        try {
          execSync(`taskkill /pid ${serverProcess.pid} /t /f`);
        } catch {
          // já morto, ou taskkill indisponível — segue o teardown de qualquer forma.
        }
      } else {
        serverProcess.kill();
      }
    }
    if (createdAdminEmail) {
      await prisma.user.deleteMany({ where: { email: createdAdminEmail } });
    }
    await prisma.platformInstallCode.deleteMany({});
    await prisma.$disconnect();
  });

  test("banco sem admin: /instalacao mostra o formulário (não 404)", async ({ page }) => {
    await page.goto(`${BASE_URL}/instalacao`);
    await expect(page.getByRole("heading", { name: "Instalar o InnoChat" })).toBeVisible();
  });

  test("código de instalação errado: erro legível no campo, admin não é criado", async ({ page }) => {
    await page.goto(`${BASE_URL}/instalacao`);
    await page.getByLabel("Código de instalação").fill("codigo-completamente-errado-000000");
    await page.getByLabel("Seu nome").fill("Admin E2E");
    await page.getByLabel("E-mail").fill("e2e-instalacao-tentativa@innochat.local");
    await page.getByLabel("Senha *", { exact: true }).fill("senha-e2e-instalacao-2026");
    await page.getByLabel("Confirmar senha").fill("senha-e2e-instalacao-2026");
    await page.getByRole("button", { name: "Concluir instalação" }).click();

    // `#code-error` é o `<p role="alert">` do campo "Código de instalação" (`Field`,
    // `src/components/ui/field.tsx`) — `getByRole("alert")` sozinho também pega o
    // `#__next-route-announcer__` do Next (sempre presente, `role="alert"`), causando violação de
    // modo estrito.
    await expect(page.locator("#code-error")).toContainText(/inválido|expirado/i);
    await expect(page).toHaveURL(/\/instalacao/);

    const admin = await prisma.user.findUnique({ where: { email: "e2e-instalacao-tentativa@innochat.local" } });
    expect(admin).toBeNull();
  });

  test("código certo: cria o admin e redireciona ao login com aviso", async ({ page }) => {
    createdAdminEmail = "e2e-instalacao-sucesso@innochat.local";

    await page.goto(`${BASE_URL}/instalacao`);
    await page.getByLabel("Código de instalação").fill(installCode);
    await page.getByLabel("Seu nome").fill("Admin E2E");
    await page.getByLabel("E-mail").fill(createdAdminEmail);
    await page.getByLabel("Senha *", { exact: true }).fill("senha-e2e-instalacao-2026");
    await page.getByLabel("Confirmar senha").fill("senha-e2e-instalacao-2026");
    await page.getByRole("button", { name: "Concluir instalação" }).click();

    await expect(page).toHaveURL(/\/login\?instalado=1/);
    await expect(page.getByText("Instalação concluída")).toBeVisible();

    const admin = await prisma.user.findUnique({ where: { email: createdAdminEmail } });
    expect(admin?.isPlatformAdmin).toBe(true);
  });

  test("depois de instalado, /instalacao responde 404 (nunca redireciona)", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/instalacao`);
    expect(response?.status()).toBe(404);
  });
});
