/**
 * Testes de integração contra Postgres real (banco separado `innochat_test`, docs/contratos.md
 * / handoff da Vega). Rodam a lógica de módulo direto (sem passar pela camada de Server Action
 * — essa exige `auth()`/contexto de requisição do Next, fora do alcance do Vitest puro; a
 * guarda de tenant é testada via `requireTenantMember` nos testes de unidade de
 * `src/lib/auth/guards.ts` quando existirem mocks de sessão. Aqui o que importa é provar que o
 * ISOLAMENTO por `forTenant`/validação manual e a CONCORRÊNCIA real do banco funcionam).
 *
 * Requer `TEST_DATABASE_URL` apontando para um banco com as migrations aplicadas
 * (`npx prisma migrate deploy` contra esse banco). Ver PARA O PRÓXIMO no handoff para o comando
 * exato usado.
 */
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { forTenant } from "@/lib/db/tenant-client";
import { cancelAppointment, createAppointmentManual, listAppointments, rescheduleAppointment } from "@/modules/agenda/appointments";
import {
  createProfessional,
  createService,
  deleteService,
  setProfessionalServices,
  setProfessionalWorkingHours,
  updateService,
} from "@/modules/agenda/catalog";
import { DomainError } from "@/lib/errors";

const prisma = getPrisma();

// Segunda-feira daqui a alguns dias (dentro do horizonte, longe o bastante da antecedência
// mínima e do "agora" do teste) — usamos o weekday real calculado, não um valor fixo, para não
// depender de qual dia é hoje quando o teste roda.
function nextWeekdayAt(daysAhead: number, hourUTCLocal: string): { date: Date; weekday: number } {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + daysAhead);
  const [h, m] = hourUTCLocal.split(":").map(Number);
  const date = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, m, 0, 0));
  return { date, weekday: date.getUTCDay() };
}

async function makeTenant(label: string) {
  return prisma.tenant.create({
    data: {
      slug: `it-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`,
      name: `Integração ${label}`,
      timezone: "UTC", // UTC evita qualquer conversão de fuso interferir no teste de concorrência/isolamento.
      minLeadTimeMin: 0,
      maxHorizonDays: 60,
    },
  });
}

async function makeBookableProfessional(tenantId: string, weekday: number, serviceId: string) {
  const professional = await createProfessional(tenantId, { name: "Profissional IT", active: true, sortOrder: 0 });
  await setProfessionalServices(tenantId, professional.id, [serviceId]);
  await setProfessionalWorkingHours(tenantId, professional.id, [{ weekday, startTime: "00:00", endTime: "23:59" }]);
  return professional;
}

const createdTenantIds: string[] = [];

afterAll(async () => {
  // Cascade cuida de professionals/services/contacts/appointments/working hours.
  await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  await prisma.$disconnect();
});

describe("agendamento concorrente — EXCLUDE do banco garante 1 sucesso e N SLOT_TAKEN", () => {
  it("20 requisições paralelas para o mesmo profissional/horário: exatamente 1 sucesso", async () => {
    const tenant = await makeTenant("concurrency");
    createdTenantIds.push(tenant.id);

    const { date: startsAt, weekday } = nextWeekdayAt(5, "14:00");
    const service = await createService(tenant.id, {
      name: "Corte",
      durationMin: 30,
      bufferAfterMin: 0,
      priceCents: null,
      active: true,
      sortOrder: 0,
    });
    const professional = await makeBookableProfessional(tenant.id, weekday, service.id);

    const attempts = Array.from({ length: 20 }, (_, i) =>
      createAppointmentManual(
        tenant.id,
        {
          contactName: `Cliente ${i}`,
          contactPhoneE164: `+551199990${String(i).padStart(4, "0")}`,
          serviceId: service.id,
          professionalId: professional.id,
          startsAt,
        },
        "actor-test-user",
      ),
    );

    const results = await Promise.allSettled(attempts);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof createAppointmentManual>>>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0].value.alreadyExisted).toBe(false);

    expect(rejected).toHaveLength(19);
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(DomainError);
      expect((r.reason as DomainError).code).toBe("SLOT_TAKEN");
    }

    // O banco reflete exatamente 1 agendamento SCHEDULED nesse horário para esse profissional.
    const scheduled = await forTenant(tenant.id).appointment.findMany({
      where: { professionalId: professional.id, startsAt, status: "SCHEDULED" },
    });
    expect(scheduled).toHaveLength(1);
  }, 30_000);
});

describe("idempotência — mesma idempotencyKey não duplica", () => {
  it("a segunda chamada com a mesma chave devolve o agendamento existente, sem criar outro", async () => {
    const tenant = await makeTenant("idempotency");
    createdTenantIds.push(tenant.id);

    const { date: startsAt, weekday } = nextWeekdayAt(6, "10:00");
    const service = await createService(tenant.id, {
      name: "Coloração",
      durationMin: 60,
      bufferAfterMin: 0,
      priceCents: null,
      active: true,
      sortOrder: 0,
    });
    const professional = await makeBookableProfessional(tenant.id, weekday, service.id);

    const input = {
      contactName: "Maria",
      contactPhoneE164: "+5511988887777",
      serviceId: service.id,
      professionalId: professional.id,
      startsAt,
      idempotencyKey: "idem-key-1",
    };

    const first = await createAppointmentManual(tenant.id, input, "actor-test-user");
    const second = await createAppointmentManual(tenant.id, input, "actor-test-user");

    expect(first.alreadyExisted).toBe(false);
    expect(second.alreadyExisted).toBe(true);
    expect((second.appointment as { id: string }).id).toBe((first.appointment as { id: string }).id);

    const count = await forTenant(tenant.id).appointment.count({ where: { professionalId: professional.id } });
    expect(count).toBe(1);
  });
});

describe("isolamento entre tenants — tenant A não lê nem altera dados do tenant B por id", () => {
  it("cancelAppointment, reschedule, catálogo e listagem nunca cruzam tenant por id", async () => {
    const tenantA = await makeTenant("iso-a");
    const tenantB = await makeTenant("iso-b");
    createdTenantIds.push(tenantA.id, tenantB.id);

    const { date: startsAtB, weekday: weekdayB } = nextWeekdayAt(7, "09:00");
    const serviceB = await createService(tenantB.id, {
      name: "Serviço B",
      durationMin: 30,
      bufferAfterMin: 0,
      priceCents: null,
      active: true,
      sortOrder: 0,
    });
    const professionalB = await makeBookableProfessional(tenantB.id, weekdayB, serviceB.id);
    const { appointment: appointmentB } = await createAppointmentManual(
      tenantB.id,
      { contactName: "Cliente B", contactPhoneE164: "+5511977776666", serviceId: serviceB.id, professionalId: professionalB.id, startsAt: startsAtB },
      "actor-b",
    );
    const appointmentBId = (appointmentB as { id: string }).id;

    // 1) Tenant A não consegue cancelar/remarcar um agendamento que é do tenant B, mesmo
    //    sabendo o id exato (nunca 200, nunca 500 — sempre o erro de domínio NOT_FOUND).
    await expect(cancelAppointment(tenantA.id, appointmentBId, "actor-a")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(rescheduleAppointment(tenantA.id, appointmentBId, new Date(startsAtB.getTime() + 3600_000), "actor-a")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // 2) Tenant A não consegue editar/excluir um Service que é do tenant B.
    await expect(updateService(tenantA.id, serviceB.id, { name: "Hackeado" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteService(tenantA.id, serviceB.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // 3) O Service do tenant B continua intacto (a tentativa do passo 2 não vazou escrita).
    const stillThere = await forTenant(tenantB.id).service.findFirst({ where: { id: serviceB.id } });
    expect(stillThere?.name).toBe("Serviço B");

    // 4) Tenant A criando um agendamento usando o contactId/serviceId/professionalId do
    //    tenant B — cada referência cruzada precisa ser rejeitada (nunca "funciona por acaso").
    const contactB = await forTenant(tenantB.id).contact.findFirstOrThrow({ where: {} });
    await expect(
      createAppointmentManual(
        tenantA.id,
        { contactId: contactB.id, serviceId: serviceB.id, professionalId: professionalB.id, startsAt: new Date(startsAtB.getTime() + 7200_000) },
        "actor-a",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    // 5) listAppointments do tenant A nunca devolve um agendamento do tenant B, mesmo com o
    //    período sobrepondo exatamente o horário do agendamento de B.
    const listedByA = await listAppointments(tenantA.id, {
      from: new Date(startsAtB.getTime() - 3600_000),
      to: new Date(startsAtB.getTime() + 3600_000),
    });
    expect(listedByA.find((a) => a.id === appointmentBId)).toBeUndefined();
  });
});
