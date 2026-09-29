/**
 * Gestão de clientes (docs/contratos.md — "Clientes") contra Postgres real: busca/filtros/
 * paginação, isolamento cross-tenant, `CONTACT_EXISTS`, o `waJid` de um cliente cadastrado pelo
 * painel batendo com o que `claimMessage` gera de verdade, pausa/retomada do bot e seu efeito na
 * `ChatSession`, anonimização preservando o histórico, e exportação CSV.
 *
 * Requer `TEST_DATABASE_URL` com as migrations aplicadas
 * (`.claude/agent-memory/vega/integration_tests_setup.md`).
 */
import { randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { createProfessional, createService, setProfessionalServices, setProfessionalWorkingHours } from "@/modules/agenda/catalog";
import { createAppointmentManual } from "@/modules/agenda/appointments";
import { claimMessage } from "@/modules/bot-api/claim";
import { updateSession } from "@/modules/bot-api/session";
import type { InternalApiContext } from "@/modules/bot-api/internal-auth";
import {
  createContact,
  deleteContact,
  exportContactsCsv,
  getContact,
  listContacts,
  setContactBotPaused,
  updateContact,
} from "@/modules/contacts/contacts";

const prisma = getPrisma();
const createdTenantIds: string[] = [];
let contactsPlanId: string | null = null;

async function getContactsPlanId() {
  if (!contactsPlanId) {
    const plan = await prisma.plan.create({
      data: { code: `it-contacts-${Date.now()}-${randomUUID().slice(0, 6)}`, name: "Plano IT clientes", priceCents: 0, maxWhatsappNumbers: 3, maxProfessionals: null, active: false, sortOrder: 999 },
    });
    contactsPlanId = plan.id;
  }
  return contactsPlanId;
}

async function makeTenant(label: string) {
  const tenant = await prisma.tenant.create({
    data: {
      slug: `it-contacts-${label}-${Date.now()}-${randomUUID().slice(0, 6)}`,
      name: `Clientes IT ${label}`,
      timezone: "UTC",
      minLeadTimeMin: 0,
      maxHorizonDays: 60,
    },
  });
  createdTenantIds.push(tenant.id);
  await prisma.subscription.create({
    data: { tenantId: tenant.id, planId: await getContactsPlanId(), status: "ACTIVE", currentPeriodEnd: addDays(new Date(), 30) },
  });
  return tenant;
}

async function makeInstance(tenantId: string, label: string) {
  const instance = await prisma.whatsappInstance.create({
    data: { tenantId, instanceName: `it-contacts-${label}-${randomUUID().slice(0, 6)}`, label: "Principal", webhookToken: randomUUID() },
  });
  const ctx: InternalApiContext = {
    tenantId,
    instance: { id: instance.id, tenantId, instanceName: instance.instanceName, sandbox: instance.sandbox, status: instance.status },
  };
  return { instance, ctx };
}

/** Horário fixo, alguns dias no futuro, longe de virada de dia — evita depender da hora em que o teste roda. */
function daysAheadAt10h(daysAhead: number): Date {
  const base = new Date();
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + daysAhead, 10, 0, 0, 0));
}

/** Libera a trava (mesmo passo que o n8n faz via `PUT /sessions/{id}` depois de responder). */
async function releaseSessionLock(ctx: InternalApiContext, result: Awaited<ReturnType<typeof claimMessage>>) {
  if (result.action !== "process") return;
  await updateSession(ctx, result.session.id, {
    lockToken: result.session.lockToken,
    version: result.session.version,
    state: result.session.state,
    context: result.session.context,
    invalidCount: result.session.invalidCount,
    outbound: [],
    handoff: false,
  });
}

function evolutionTextPayload(opts: { jid: string; id: string; text: string }) {
  return {
    event: "messages.upsert",
    data: {
      key: { remoteJid: opts.jid, fromMe: false, id: opts.id },
      pushName: "Cliente Bot",
      message: { conversation: opts.text },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };
}

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  if (contactsPlanId) await prisma.plan.delete({ where: { id: contactsPlanId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("listContacts — busca, filtros e paginação", () => {
  it("busca por nome e por telefone (dígitos), pagina com cursor, exclui anonimizados", async () => {
    const tenant = await makeTenant("search");

    await createContact(tenant.id, { name: "Maria da Silva", phone: "(84) 99972-7583" });
    await createContact(tenant.id, { name: "João Souza", phone: "(84) 98888-1234" });
    const carla = await createContact(tenant.id, { name: "Carla Dias", phone: "(84) 97777-1111" });

    const byName = await listContacts(tenant.id, { q: "maria" });
    expect(byName.items.map((c) => c.name)).toEqual(["Maria da Silva"]);

    const byPhone = await listContacts(tenant.id, { q: "988881234" });
    expect(byPhone.items.map((c) => c.name)).toEqual(["João Souza"]);

    const page1 = await listContacts(tenant.id, { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listContacts(tenant.id, { limit: 2, cursor: page1.nextCursor! });
    const allNames = [...page1.items, ...page2.items].map((c) => c.name).sort();
    expect(allNames).toEqual(["Carla Dias", "João Souza", "Maria da Silva"]);
    expect(page2.nextCursor).toBeNull();

    // Anonimizado nunca aparece na listagem, mesmo sem filtro nenhum.
    await deleteContact(tenant.id, carla.id);
    const afterAnon = await listContacts(tenant.id, {});
    expect(afterAnon.items.map((c) => c.id)).not.toContain(carla.id);
  });

  it("filtro upcoming/botPaused/inactive90d", async () => {
    const tenant = await makeTenant("filters");
    const service = await createService(tenant.id, { name: "Corte", durationMin: 30, bufferAfterMin: 0, priceCents: null, active: true, sortOrder: 0 });
    const professional = await createProfessional(tenant.id, { name: "Prof IT", active: true, sortOrder: 0 });
    await setProfessionalServices(tenant.id, professional.id, [service.id]);
    await setProfessionalWorkingHours(
      tenant.id,
      professional.id,
      Array.from({ length: 7 }, (_, weekday) => ({ weekday, startTime: "00:00", endTime: "23:59" })),
    );

    const withUpcoming = await createContact(tenant.id, { name: "Com Agendamento", phone: "(84) 99900-0001" });
    const paused = await createContact(tenant.id, { name: "Bot Pausado", phone: "(84) 99900-0002" });
    const inactive = await createContact(tenant.id, { name: "Inativo", phone: "(84) 99900-0003" });

    const startsAt = daysAheadAt10h(3);
    await createAppointmentManual(tenant.id, { contactId: withUpcoming.id, serviceId: service.id, professionalId: professional.id, startsAt }, "system-test");

    await setContactBotPaused(tenant.id, paused.id, { paused: true, hours: 1 });

    const upcoming = await listContacts(tenant.id, { filter: "upcoming" });
    expect(upcoming.items.map((c) => c.id)).toEqual([withUpcoming.id]);

    const botPaused = await listContacts(tenant.id, { filter: "botPaused" });
    expect(botPaused.items.map((c) => c.id)).toEqual([paused.id]);

    // "inactive90d" exige TER histórico de agendamento (mas nenhum recente) — sem nenhum
    // agendamento nunca, o cliente cai fora desse filtro por design (documentado em contracts.md).
    const inactive90d = await listContacts(tenant.id, { filter: "inactive90d" });
    expect(inactive90d.items.map((c) => c.id)).not.toContain(inactive.id);
  });
});

describe("isolamento cross-tenant", () => {
  it("getContact/updateContact/deleteContact de um id de outro tenant → NOT_FOUND", async () => {
    const tenantA = await makeTenant("cross-a");
    const tenantB = await makeTenant("cross-b");
    const contact = await createContact(tenantA.id, { name: "Só da A", phone: "(84) 99911-0000" });

    await expect(getContact(tenantB.id, contact.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateContact(tenantB.id, contact.id, { name: "Hackeado" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteContact(tenantB.id, contact.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Confirma que na A continua intacto.
    const stillA = await getContact(tenantA.id, contact.id);
    expect(stillA.name).toBe("Só da A");
  });
});

describe("createContact — duplicidade", () => {
  it("mesmo telefone duas vezes → CONTACT_EXISTS com o id do cliente existente", async () => {
    const tenant = await makeTenant("dup");
    const first = await createContact(tenant.id, { name: "Primeiro", phone: "84999887766" });

    await expect(createContact(tenant.id, { name: "Segundo", phone: "(84) 99988-7766" })).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe("CONTACT_EXISTS");
      expect((error as DomainError).details).toMatchObject({ contactId: first.id });
      return true;
    });
  });

  it("telefone inválido → INVALID_PAYLOAD", async () => {
    const tenant = await makeTenant("invalid-phone");
    await expect(createContact(tenant.id, { name: "X", phone: "123" })).rejects.toMatchObject({ code: "INVALID_PAYLOAD" });
  });
});

describe("waJid do cliente cadastrado pelo painel bate com o que o bot gera (não duplica)", () => {
  it("cliente cadastrado no painel, depois manda mensagem pelo WhatsApp com o JID SEM o 9º dígito — mesmo Contact", async () => {
    const tenant = await makeTenant("wajid-sem-9");
    const { ctx } = await makeInstance(tenant.id, "sem-9");

    const created = await createContact(tenant.id, { name: "Cliente Painel", phone: "84999727583" });

    const payload = evolutionTextPayload({ jid: "558499727583@s.whatsapp.net", id: `msg-${randomUUID()}`, text: "oi" });
    const result = await claimMessage(ctx, payload);

    expect(result.action).toBe("process");
    if (result.action === "process") {
      expect(result.contact.id).toBe(created.id); // não duplicou
    }
  });

  it("cliente já tinha mandado mensagem (waJid real já existe) — createContact detecta e devolve CONTACT_EXISTS", async () => {
    const tenant = await makeTenant("wajid-preexistente");
    const { ctx } = await makeInstance(tenant.id, "preexistente");

    const payload = evolutionTextPayload({ jid: "5584999727583@s.whatsapp.net", id: `msg-${randomUUID()}`, text: "oi" });
    const claimResult = await claimMessage(ctx, payload);
    expect(claimResult.action).toBe("process");
    const existingContactId = claimResult.action === "process" ? claimResult.contact.id : null;

    await expect(createContact(tenant.id, { name: "Cadastro Manual", phone: "84999727583" })).rejects.toMatchObject({
      code: "CONTACT_EXISTS",
      details: { contactId: existingContactId },
    });
  });
});

describe("pausa do bot", () => {
  it("pausar faz o claim ignorar (BOT_PAUSED); retomar zera botPausedUntil e humanUntil da ChatSession, claim volta a processar", async () => {
    const tenant = await makeTenant("pause");
    const { ctx } = await makeInstance(tenant.id, "pause");

    const jid = "5584988887777@s.whatsapp.net";
    const first = await claimMessage(ctx, evolutionTextPayload({ jid, id: `msg-${randomUUID()}`, text: "primeira" }));
    expect(first.action).toBe("process");
    const contactId = first.action === "process" ? first.contact.id : "";
    await releaseSessionLock(ctx, first); // mesmo passo que o n8n faz depois de responder (libera a trava de 20s)

    await setContactBotPaused(tenant.id, contactId, { paused: true });

    const whilePaused = await claimMessage(ctx, evolutionTextPayload({ jid, id: `msg-${randomUUID()}`, text: "segunda" }));
    expect(whilePaused).toMatchObject({ action: "ignore", reason: "BOT_PAUSED" });

    // Simula sessão em modo humano, para provar que retomar zera isso também.
    await prisma.chatSession.updateMany({ where: { contactId }, data: { state: "HUMAN", humanUntil: addDays(new Date(), 1) } });

    const resumed = await setContactBotPaused(tenant.id, contactId, { paused: false });
    expect(resumed.botPausedUntil).toBeNull();

    const session = await prisma.chatSession.findFirstOrThrow({ where: { contactId } });
    expect(session.humanUntil).toBeNull();
    expect(session.state).toBe("MAIN_MENU");

    const afterResume = await claimMessage(ctx, evolutionTextPayload({ jid, id: `msg-${randomUUID()}`, text: "terceira" }));
    expect(afterResume.action).toBe("process");
  });
});

describe("deleteContact — exclusão vs anonimização", () => {
  it("sem agendamentos → apaga de verdade", async () => {
    const tenant = await makeTenant("delete-clean");
    const contact = await createContact(tenant.id, { name: "Sem Histórico", phone: "84999000011" });

    const result = await deleteContact(tenant.id, contact.id);
    expect(result.mode).toBe("deleted");

    await expect(getContact(tenant.id, contact.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("com agendamentos → anonimiza, preserva o histórico", async () => {
    const tenant = await makeTenant("delete-anon");
    const service = await createService(tenant.id, { name: "Corte", durationMin: 30, bufferAfterMin: 0, priceCents: null, active: true, sortOrder: 0 });
    const professional = await createProfessional(tenant.id, { name: "Prof", active: true, sortOrder: 0 });
    await setProfessionalServices(tenant.id, professional.id, [service.id]);
    await setProfessionalWorkingHours(
      tenant.id,
      professional.id,
      Array.from({ length: 7 }, (_, weekday) => ({ weekday, startTime: "00:00", endTime: "23:59" })),
    );

    const contact = await createContact(tenant.id, { name: "Com Histórico", phone: "84999000022" });
    const startsAt = daysAheadAt10h(2);
    const { appointment } = await createAppointmentManual(
      tenant.id,
      { contactId: contact.id, serviceId: service.id, professionalId: professional.id, startsAt },
      "system-test",
    );

    const result = await deleteContact(tenant.id, contact.id);
    expect(result.mode).toBe("anonymized");

    const reloadedAppointment = await prisma.appointment.findUniqueOrThrow({ where: { id: (appointment as { id: string }).id } });
    expect(reloadedAppointment.contactId).toBe(contact.id); // histórico intacto

    const reloadedContact = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
    expect(reloadedContact.name).toBeNull();
    expect(reloadedContact.phoneE164).toBeNull();
    expect(reloadedContact.waJid).toBe(`anon:${contact.id}`);
  });
});

describe("exportContactsCsv", () => {
  it("UTF-8 com BOM, separador ';', cabeçalho e linhas dos clientes", async () => {
    const tenant = await makeTenant("csv");
    await createContact(tenant.id, { name: "Exportado Um", phone: "84999000033" });
    await createContact(tenant.id, { name: "Exportado Dois", phone: "84999000044" });

    const { filename, csv } = await exportContactsCsv(tenant.id);
    expect(filename).toMatch(/^clientes-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("Nome;Telefone;Agendamentos;Faltas;Último;Próximo;Criado em");
    expect(lines.some((l) => l.startsWith("Exportado Um;"))).toBe(true);
    expect(lines.some((l) => l.startsWith("Exportado Dois;"))).toBe(true);
  });

  it("neutraliza injeção de fórmula vinda do nome do perfil do WhatsApp", async () => {
    const tenant = await makeTenant("csv-formula");
    const { id } = await createContact(tenant.id, { name: "Temporário", phone: "84999000055" });
    await prisma.contact.update({ where: { id }, data: { name: null, pushName: '=HYPERLINK("http://x.test","clique")' } });

    const { csv } = await exportContactsCsv(tenant.id);
    const row = csv.slice(1).split("\r\n").find((l) => l.includes("HYPERLINK"));
    expect(row).toBeDefined();
    expect(row!.startsWith(`"'=HYPERLINK`)).toBe(true);
  });
});
