/**
 * O lembrete de véspera roda DENTRO do tick de cobrança, mas uma falha dele nunca pode derrubar a
 * cobrança (nem o resumo). `runReminderTick` é trocado por um que lança; o resto do tick (aqui, a
 * anulação de fatura de teste cancelado) continua acontecendo.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return { ...actual, sendMail: vi.fn(async () => ({ sent: true })) };
});

const reminder = vi.hoisted(() => ({ mode: "throw" as "throw" | "ok", onRun: null as null | (() => Promise<void>) }));
vi.mock("@/modules/reminders/tick", () => ({
  runReminderTick: vi.fn(async () => {
    await reminder.onRun?.();
    if (reminder.mode === "throw") throw new Error("boom no lembrete");
    return { remindersToClientsSent: 3, remindersToClientsFailed: 0 };
  }),
}));

const { runBillingTick } = await import("@/modules/billing/tick");

const prisma = getPrisma();
const tenantIds: string[] = [];
const planIds: string[] = [];

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prisma.plan.deleteMany({ where: { id: { in: planIds } } });
  await prisma.$disconnect();
});

describe("runBillingTick + lembrete de véspera", () => {
  it("falha do lembrete é isolada: o tick termina, remindersToClientsSent = 0 e a cobrança segue", async () => {
    const tenant = await prisma.tenant.create({ data: { slug: `it-tick-rem-${randomUUID().slice(0, 8)}`, name: "Tick Rem", timezone: "UTC" } });
    tenantIds.push(tenant.id);
    const plan = await prisma.plan.create({
      data: { code: `it-tick-rem-${randomUUID().slice(0, 8)}`, name: "Plano IT", priceCents: 4990, maxWhatsappNumbers: 1, maxProfessionals: 1, active: false, sortOrder: 999 },
    });
    planIds.push(plan.id);
    const past = new Date(Date.now() - 24 * 3600_000);
    const subscription = await prisma.subscription.create({
      data: { tenantId: tenant.id, planId: plan.id, status: "CANCELED", currentPeriodEnd: past, canceledAt: past },
    });
    const invoice = await prisma.invoice.create({
      data: {
        subscriptionId: subscription.id,
        amountCents: 4990,
        periodStart: past,
        periodEnd: new Date(Date.now() + 5 * 24 * 3600_000),
        dueAt: new Date(Date.now() + 5 * 24 * 3600_000),
        status: "OPEN",
        isTrialConversion: true,
      },
    });

    reminder.mode = "throw";
    const summary = await runBillingTick(new Date());

    expect(summary.remindersToClientsSent).toBe(0);
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("VOID");
  });

  it("sem falha, o resumo traz o total enviado", async () => {
    reminder.mode = "ok";
    const summary = await runBillingTick(new Date());
    expect(summary.remindersToClientsSent).toBe(3);
  });

  it("registra a execução de cobrança ANTES do lembrete (o ritmo lento dele não atrasa o 'quando rodou' da Saúde)", async () => {
    reminder.mode = "ok";
    const now = new Date(Date.now() + 3_600_000); // instante único para reconhecer a nossa gravação
    let recordedBeforeReminder: string | null = null;
    reminder.onRun = async () => {
      const row = await prisma.platformSettings.findUnique({ where: { id: 1 } });
      recordedBeforeReminder = row?.lastBillingTickAt?.toISOString() ?? null;
    };
    try {
      await runBillingTick(now);
    } finally {
      reminder.onRun = null;
    }
    expect(recordedBeforeReminder).toBe(now.toISOString());
    const final = await prisma.platformSettings.findUniqueOrThrow({ where: { id: 1 } });
    expect(final.lastBillingTickResult).toMatchObject({ remindersToClientsSent: 3 }); // regravado com o resumo completo
  });
});
