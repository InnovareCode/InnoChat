/**
 * Onboarding (docs/contratos.md — "Onboarding") contra Postgres real: derivação de cada step
 * a partir dos dados, isolamento entre empresas, tour por usuário (concluir/pular/reiniciar) e
 * dismiss do checklist por empresa.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { completeOnboardingTour, dismissOnboardingChecklist, getOnboardingState, restartOnboardingTour } from "@/modules/onboarding/service";

const prisma = getPrisma();
const tenantIds: string[] = [];
const userIds: string[] = [];

async function makeTenant(label: string) {
  const tenant = await prisma.tenant.create({
    data: { slug: `it-onb-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`, name: `Onb ${label}`, timezone: "UTC" },
  });
  tenantIds.push(tenant.id);
  return tenant;
}

async function makeUser(tenantId: string) {
  const user = await prisma.user.create({ data: { email: `it-onb-${randomUUID()}@example.test`, passwordHash: "x" } });
  userIds.push(user.id);
  await prisma.membership.create({ data: { userId: user.id, tenantId, role: "STAFF" } });
  return user;
}

const doneOf = (s: Awaited<ReturnType<typeof getOnboardingState>>) => Object.fromEntries(s.steps.map((x) => [x.key, x.done]));

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("onboarding — steps derivados dos dados", () => {
  it("empresa vazia: nada feito, ordem fixa das chaves, allDone=false", async () => {
    const t = await makeTenant("vazia");
    const u = await makeUser(t.id);
    const s = await getOnboardingState(u.id, t.id);
    expect(s.steps.map((x) => x.key)).toEqual(["services", "professionals", "hours", "whatsapp", "botTest"]);
    expect(s.steps.every((x) => !x.done)).toBe(true);
    expect(s.allDone).toBe(false);
    expect(s.tourCompletedAt).toBeNull();
    expect(s.checklistDismissedAt).toBeNull();
  });

  it("cada step acende só com o dado certo (e inativo/deletado/sandbox/PANEL não contam)", async () => {
    const t = await makeTenant("steps");
    const u = await makeUser(t.id);
    const other = await makeTenant("outra");

    // Dados de OUTRA empresa não vazam.
    await prisma.service.create({ data: { tenantId: other.id, name: "X", durationMin: 30 } });
    expect(doneOf(await getOnboardingState(u.id, t.id)).services).toBe(false);

    // Serviço inativo não conta; ativo conta.
    await prisma.service.create({ data: { tenantId: t.id, name: "Inativo", durationMin: 30, active: false } });
    expect(doneOf(await getOnboardingState(u.id, t.id)).services).toBe(false);
    const service = await prisma.service.create({ data: { tenantId: t.id, name: "Corte", durationMin: 30 } });
    expect(doneOf(await getOnboardingState(u.id, t.id)).services).toBe(true);

    // Profissional inativo (mesmo com horário) não conta; sem horário: professionals sim, hours não.
    const inactive = await prisma.professional.create({ data: { tenantId: t.id, name: "Off", active: false } });
    await prisma.workingHour.create({ data: { professionalId: inactive.id, weekday: 1, startTime: "09:00", endTime: "18:00" } });
    let d = doneOf(await getOnboardingState(u.id, t.id));
    expect(d.professionals).toBe(false);
    expect(d.hours).toBe(false);
    const pro = await prisma.professional.create({ data: { tenantId: t.id, name: "Ana" } });
    d = doneOf(await getOnboardingState(u.id, t.id));
    expect(d.professionals).toBe(true);
    expect(d.hours).toBe(false);
    await prisma.workingHour.create({ data: { professionalId: pro.id, weekday: 2, startTime: "09:00", endTime: "18:00" } });
    expect(doneOf(await getOnboardingState(u.id, t.id)).hours).toBe(true);

    // WhatsApp: QRCODE, deletada e sandbox não contam; CONNECTED real conta.
    const mk = (extra: Record<string, unknown>) =>
      prisma.whatsappInstance.create({
        data: { tenantId: t.id, instanceName: `it-onb-${randomUUID().slice(0, 8)}`, label: "N", webhookToken: randomUUID(), ...extra },
      });
    await mk({ status: "QRCODE" });
    await mk({ status: "CONNECTED", deletedAt: new Date() });
    await mk({ status: "CONNECTED", sandbox: true });
    expect(doneOf(await getOnboardingState(u.id, t.id)).whatsapp).toBe(false);
    const inst = await mk({ status: "CONNECTED" });
    expect(doneOf(await getOnboardingState(u.id, t.id)).whatsapp).toBe(true);

    // botTest: agendamento PANEL não conta; WHATSAPP conta.
    const contact = await prisma.contact.create({ data: { tenantId: t.id, name: "Cli", waJid: `${randomUUID().slice(0, 10)}@s.whatsapp.net` } });
    const base = { tenantId: t.id, contactId: contact.id, serviceId: service.id, professionalId: pro.id };
    const at = (h: number) => {
      const s = new Date(Date.UTC(2031, 0, 6, h, 0, 0));
      return { startsAt: s, endsAt: new Date(s.getTime() + 1800000), blockEndsAt: new Date(s.getTime() + 1800000) };
    };
    await prisma.appointment.create({ data: { ...base, ...at(10), source: "PANEL" } });
    expect(doneOf(await getOnboardingState(u.id, t.id)).botTest).toBe(false);
    await prisma.appointment.create({ data: { ...base, ...at(12), source: "WHATSAPP", whatsappInstanceId: inst.id } });
    const final = await getOnboardingState(u.id, t.id);
    expect(doneOf(final).botTest).toBe(true);
    expect(final.allDone).toBe(true);

    // A outra empresa continua sem nada além do serviço.
    const ou = await makeUser(other.id);
    const os = await getOnboardingState(ou.id, other.id);
    expect(os.steps.filter((x) => x.done).map((x) => x.key)).toEqual(["services"]);
  });
});

describe("onboarding — tour (por usuário) e checklist (por empresa)", () => {
  it("concluir/pular é idempotente e só afeta o usuário; reiniciar zera", async () => {
    const t = await makeTenant("tour");
    const a = await makeUser(t.id);
    const b = await makeUser(t.id);

    const first = await completeOnboardingTour(a.id, t.id);
    expect(first.tourCompletedAt).not.toBeNull();
    const again = await completeOnboardingTour(a.id, t.id);
    expect(again.tourCompletedAt).toBe(first.tourCompletedAt);

    // Funcionário novo (outro usuário) ainda vê o tour.
    expect((await getOnboardingState(b.id, t.id)).tourCompletedAt).toBeNull();

    const restarted = await restartOnboardingTour(a.id, t.id);
    expect(restarted.tourCompletedAt).toBeNull();
    // Tour não mexe no checklist.
    expect(restarted.checklistDismissedAt).toBeNull();
  });

  it("dismiss do checklist é por empresa, idempotente, e não toca no tour", async () => {
    const t1 = await makeTenant("dis1");
    const t2 = await makeTenant("dis2");
    const u1 = await makeUser(t1.id);
    const u2 = await makeUser(t2.id);

    const s = await dismissOnboardingChecklist(u1.id, t1.id);
    expect(s.checklistDismissedAt).not.toBeNull();
    expect(s.tourCompletedAt).toBeNull();
    expect((await dismissOnboardingChecklist(u1.id, t1.id)).checklistDismissedAt).toBe(s.checklistDismissedAt);
    expect((await getOnboardingState(u2.id, t2.id)).checklistDismissedAt).toBeNull();
  });
});
