/**
 * Histórico de conversas do WhatsApp (ChatMessage) contra Postgres real: entrada (claim), saída
 * (PUT /sessions), deduplicação, leitura paginada, isolamento entre empresas, retenção de 90 dias
 * e apagamento na anonimização/exclusão de contato (LGPD).
 */
import { randomUUID } from "node:crypto";
import { addDays } from "date-fns";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { hashInternalApiSecret } from "@/modules/platform/service";
import type { InternalApiContext } from "@/modules/bot-api/internal-auth";

const sessionState: { userId: string | null } = { userId: null };
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => (sessionState.userId ? { user: { id: sessionState.userId } } : null)) }));

const { claimMessage } = await import("@/modules/bot-api/claim");
const { updateSession } = await import("@/modules/bot-api/session");
const { getConversation } = await import("@/modules/conversations/service");
const { getConversationAction } = await import("@/modules/conversations/actions");
const { deleteContact } = await import("@/modules/contacts/contacts");
const { runMaintenanceTick } = await import("@/modules/maintenance/tick");

const prisma = getPrisma();
const tenantIds: string[] = [];
const userIds: string[] = [];
let planId: string | null = null;

async function getPlanId() {
  if (!planId) {
    const plan = await prisma.plan.create({
      data: { code: `it-conv-${randomUUID().slice(0, 8)}`, name: "Plano IT conversas", priceCents: 0, maxWhatsappNumbers: 5, maxProfessionals: null, active: false, sortOrder: 999 },
    });
    planId = plan.id;
  }
  return planId;
}

async function makeWorld(label: string, opts: { sandbox?: boolean } = {}) {
  const tenant = await prisma.tenant.create({
    data: { slug: `it-conv-${label}-${randomUUID().slice(0, 8)}`, name: `Conv ${label}`, timezone: "UTC" },
  });
  tenantIds.push(tenant.id);
  await prisma.subscription.create({
    data: { tenantId: tenant.id, planId: await getPlanId(), status: "ACTIVE", currentPeriodEnd: addDays(new Date(), 30) },
  });
  const instance = await prisma.whatsappInstance.create({
    data: { tenantId: tenant.id, instanceName: `it-conv-${label}-${randomUUID().slice(0, 8)}`, label: `Numero ${label}`, webhookToken: randomUUID(), sandbox: opts.sandbox ?? false },
  });
  const ctx: InternalApiContext = {
    tenantId: tenant.id,
    instance: { id: instance.id, tenantId: tenant.id, instanceName: instance.instanceName, sandbox: instance.sandbox, status: instance.status },
  };
  return { tenant, instance, ctx };
}

function payload(opts: { instance: string; jid: string; id: string; text?: string; media?: string; fromMe?: boolean }) {
  return {
    event: "messages.upsert",
    instance: opts.instance,
    data: {
      key: { remoteJid: opts.jid, fromMe: opts.fromMe ?? false, id: opts.id },
      pushName: "Cliente",
      message: opts.media ? { [opts.media]: { mimetype: "x" } } : { conversation: opts.text ?? "" },
      messageTimestamp: Math.floor(Date.now() / 1000),
    },
  };
}

let seq = 0;
const nextJid = () => `5511${String(900000000 + ++seq * 7 + Math.floor(Math.random() * 1000))}@s.whatsapp.net`;

async function seedMessages(tenantId: string, contactId: string, instanceId: string, count: number, startMsAgo: number) {
  const base = Date.now() - startMsAgo;
  await prisma.chatMessage.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      tenantId,
      contactId,
      whatsappInstanceId: instanceId,
      direction: i % 2 === 0 ? ("INBOUND" as const) : ("OUTBOUND" as const),
      body: `msg-${i}`,
      createdAt: new Date(base + i * 1000),
    })),
  });
}

beforeEach(async () => {
  sessionState.userId = null;
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: { id: 1, internalApiSecretHash: hashInternalApiSecret("test-internal-secret-0123456789") },
    update: {},
  });
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (planId) await prisma.plan.delete({ where: { id: planId } });
  await prisma.$disconnect();
});

describe("histórico — entrada (claim)", () => {
  it("grava a mensagem de texto do cliente como INBOUND e deduplica pelo providerMessageId", async () => {
    const { tenant, instance, ctx } = await makeWorld("in");
    const jid = nextJid();
    const id = `in-${randomUUID()}`;

    const first = await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id, text: "Oi, quero agendar" }));
    expect(first.action).toBe("process");
    const second = await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id, text: "Oi, quero agendar" }));
    expect(second).toEqual({ action: "ignore", reason: "DUPLICATE" });

    const rows = await prisma.chatMessage.findMany({ where: { tenantId: tenant.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ direction: "INBOUND", body: "Oi, quero agendar", providerMessageId: id, whatsappInstanceId: instance.id });
  });

  it("dedupe por constraint: mesmo providerMessageId gravado duas vezes vira uma linha só (P2002 absorvido)", async () => {
    const { tenant, instance } = await makeWorld("dupe");
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid() } });
    const { logChatMessage } = await import("@/modules/conversations/log");
    const entry = { tenantId: tenant.id, whatsappInstanceId: instance.id, contactId: contact.id, direction: "INBOUND" as const, body: "x", providerMessageId: "same-id" };
    expect(await logChatMessage(entry)).toBe(true);
    expect(await logChatMessage(entry)).toBe(false);
    expect(await prisma.chatMessage.count({ where: { tenantId: tenant.id } })).toBe(1);
  });

  it("mídia vira placeholder ([imagem], [áudio]) — sem binário", async () => {
    const { tenant, instance, ctx } = await makeWorld("media");
    const jid = nextJid();
    await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id: `m1-${randomUUID()}`, media: "imageMessage" }));
    // segunda mensagem só depois de liberar a trava da primeira (senão volta `busy`)
    await prisma.chatSession.updateMany({ where: { whatsappInstanceId: instance.id }, data: { lockToken: null, lockedUntil: null } });
    await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id: `m2-${randomUUID()}`, media: "audioMessage" }));

    const bodies = (await prisma.chatMessage.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "asc" } })).map((r) => r.body);
    expect(bodies).toEqual(["[imagem]", "[áudio]"]);
  });

  it("registra também o que o bot ignora: cliente com bot pausado e assinatura suspensa", async () => {
    const { tenant, instance, ctx } = await makeWorld("ignored");
    const jid = nextJid();
    await prisma.contact.create({ data: { tenantId: tenant.id, waJid: jid, botPausedUntil: addDays(new Date(), 1) } });

    const res = await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id: `p-${randomUUID()}`, text: "alguem ai?" }));
    expect(res).toEqual({ action: "ignore", reason: "BOT_PAUSED" });
    const rows = await prisma.chatMessage.findMany({ where: { tenantId: tenant.id } });
    expect(rows.map((r) => [r.direction, r.body])).toEqual([["INBOUND", "alguem ai?"]]);
  });

  it("fromMe: eco do bot não é gravado; texto digitado pela empresa vira OUTBOUND", async () => {
    const { tenant, instance, ctx } = await makeWorld("fromme");
    const jid = nextJid();
    const first = await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id: `f1-${randomUUID()}`, text: "oi" }));
    if (first.action !== "process") throw new Error("esperava process");
    // O bot responde (grava a saída) — isso registra 1 OUTBOUND e a marca de eco.
    await updateSession(ctx, first.session.id, {
      lockToken: first.session.lockToken,
      version: first.session.version,
      state: "MAIN_MENU",
      context: {},
      invalidCount: 0,
      outbound: ["Olá! Como posso ajudar?"],
      handoff: false,
    });
    const echo = await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id: `f2-${randomUUID()}`, text: "Olá! Como posso ajudar?", fromMe: true }));
    expect(echo).toEqual({ action: "ignore", reason: "FROM_ME_ECHO" });

    await prisma.chatSession.updateMany({ where: { whatsappInstanceId: instance.id }, data: { lockToken: null, lockedUntil: null, state: "MAIN_MENU", humanUntil: null } });
    await prisma.contact.updateMany({ where: { tenantId: tenant.id }, data: { botPausedUntil: null } });
    const human = await claimMessage(ctx, payload({ instance: instance.instanceName, jid, id: `f3-${randomUUID()}`, text: "Oi, aqui é a Bia, já te atendo", fromMe: true }));
    expect(human).toEqual({ action: "ignore", reason: "HUMAN_TOOK_OVER" });

    const rows = await prisma.chatMessage.findMany({ where: { tenantId: tenant.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(rows.map((r) => [r.direction, r.body])).toEqual([
      ["INBOUND", "oi"],
      ["OUTBOUND", "Olá! Como posso ajudar?"],
      ["OUTBOUND", "Oi, aqui é a Bia, já te atendo"],
    ]);
  });
});

describe("histórico — saída (PUT /sessions)", () => {
  it("grava as respostas do bot como OUTBOUND, na ordem; LOCK_LOST não grava nada", async () => {
    const { tenant, instance, ctx } = await makeWorld("out");
    const first = await claimMessage(ctx, payload({ instance: instance.instanceName, jid: nextJid(), id: `o1-${randomUUID()}`, text: "menu" }));
    if (first.action !== "process") throw new Error("esperava process");

    const base = { state: "MAIN_MENU", context: {}, invalidCount: 0, handoff: false };
    await expect(
      updateSession(ctx, first.session.id, { ...base, lockToken: "trava-errada", version: first.session.version, outbound: ["não deve gravar"] }),
    ).rejects.toMatchObject({ code: "LOCK_LOST" });
    expect(await prisma.chatMessage.count({ where: { tenantId: tenant.id, direction: "OUTBOUND" } })).toBe(0);

    await updateSession(ctx, first.session.id, { ...base, lockToken: first.session.lockToken, version: first.session.version, outbound: ["primeira", "segunda"] });
    const rows = await prisma.chatMessage.findMany({ where: { tenantId: tenant.id, direction: "OUTBOUND" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(rows.map((r) => r.body)).toEqual(["primeira", "segunda"]);
    expect(rows[0].contactId).toBe(first.contact.id);
  });

  it("instância sandbox segue a mesma regra (entrada e saída)", async () => {
    const { tenant, instance, ctx } = await makeWorld("sandbox", { sandbox: true });
    const first = await claimMessage(ctx, payload({ instance: instance.instanceName, jid: nextJid(), id: `s1-${randomUUID()}`, text: "teste" }));
    if (first.action !== "process") throw new Error("esperava process");
    await updateSession(ctx, first.session.id, {
      lockToken: first.session.lockToken,
      version: first.session.version,
      state: "MAIN_MENU",
      context: {},
      invalidCount: 0,
      outbound: ["resposta sandbox"],
      handoff: false,
    });
    const rows = await prisma.chatMessage.findMany({ where: { tenantId: tenant.id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(rows.map((r) => [r.direction, r.body])).toEqual([
      ["INBOUND", "teste"],
      ["OUTBOUND", "resposta sandbox"],
    ]);
  });
});

describe("histórico — leitura", () => {
  it("página de 50, antigas no topo/novas embaixo, cursor carrega as mais antigas sem repetir nem perder", async () => {
    const { tenant, instance } = await makeWorld("page");
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid() } });
    await seedMessages(tenant.id, contact.id, instance.id, 120, 3_600_000);

    const p1 = await getConversation(tenant.id, contact.id);
    expect(p1.items).toHaveLength(50);
    expect(p1.items[0].body).toBe("msg-70");
    expect(p1.items[49].body).toBe("msg-119");
    expect(p1.items[0].instanceLabel).toBe("Numero page");
    expect(p1.nextCursor).not.toBeNull();

    const p2 = await getConversation(tenant.id, contact.id, p1.nextCursor!);
    expect(p2.items).toHaveLength(50);
    expect(p2.items[0].body).toBe("msg-20");
    expect(p2.items[49].body).toBe("msg-69");

    const p3 = await getConversation(tenant.id, contact.id, p2.nextCursor!);
    expect(p3.items.map((i) => i.body)).toEqual(Array.from({ length: 20 }, (_, i) => `msg-${i}`));
    expect(p3.nextCursor).toBeNull();

    await expect(getConversation(tenant.id, contact.id, "lixo")).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  });

  it("mensagens com o mesmo createdAt não se perdem entre páginas (desempate por id)", async () => {
    const { tenant, instance } = await makeWorld("tie");
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid() } });
    const same = new Date(Date.now() - 60_000);
    await prisma.chatMessage.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({ tenantId: tenant.id, contactId: contact.id, whatsappInstanceId: instance.id, direction: "INBOUND" as const, body: `t-${i}`, createdAt: same })),
    });
    const p1 = await getConversation(tenant.id, contact.id);
    const p2 = await getConversation(tenant.id, contact.id, p1.nextCursor!);
    const ids = new Set([...p1.items, ...p2.items].map((i) => i.id));
    expect(p1.items).toHaveLength(50);
    expect(p2.items).toHaveLength(10);
    expect(ids.size).toBe(60);
  });

  it("isolamento: cliente de outra empresa dá NOT_FOUND e as mensagens não vazam", async () => {
    const a = await makeWorld("isoA");
    const b = await makeWorld("isoB");
    const ca = await prisma.contact.create({ data: { tenantId: a.tenant.id, waJid: nextJid() } });
    const cb = await prisma.contact.create({ data: { tenantId: b.tenant.id, waJid: nextJid() } });
    await seedMessages(a.tenant.id, ca.id, a.instance.id, 3, 60_000);
    await seedMessages(b.tenant.id, cb.id, b.instance.id, 2, 60_000);

    expect((await getConversation(a.tenant.id, ca.id)).items).toHaveLength(3);
    await expect(getConversation(a.tenant.id, cb.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await getConversation(b.tenant.id, cb.id)).items).toHaveLength(2);
  });

  it("action: OWNER e STAFF leem; quem não é membro (ou sem sessão) não", async () => {
    const w = await makeWorld("action");
    const contact = await prisma.contact.create({ data: { tenantId: w.tenant.id, waJid: nextJid() } });
    await seedMessages(w.tenant.id, contact.id, w.instance.id, 2, 60_000);

    const mk = async (role: "OWNER" | "STAFF" | null) => {
      const u = await prisma.user.create({ data: { email: `it-conv-${randomUUID().slice(0, 8)}@example.test`, passwordHash: "x" } });
      userIds.push(u.id);
      if (role) await prisma.membership.create({ data: { userId: u.id, tenantId: w.tenant.id, role } });
      return u;
    };
    const owner = await mk("OWNER");
    const staff = await mk("STAFF");
    const outsider = await mk(null);

    for (const u of [owner, staff]) {
      sessionState.userId = u.id;
      const r = await getConversationAction({ tenantSlug: w.tenant.slug, contactId: contact.id });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.data.items).toHaveLength(2);
    }
    sessionState.userId = outsider.id;
    const denied = await getConversationAction({ tenantSlug: w.tenant.slug, contactId: contact.id });
    expect(denied).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    sessionState.userId = null;
    const anon = await getConversationAction({ tenantSlug: w.tenant.slug, contactId: contact.id });
    expect(anon).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });
});

describe("histórico — retenção e LGPD", () => {
  it("maintenance/tick apaga mensagens com mais de 90 dias e mantém as recentes", async () => {
    const { tenant, instance } = await makeWorld("ret");
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid() } });
    const mk = (body: string, daysAgo: number) =>
      prisma.chatMessage.create({ data: { tenantId: tenant.id, contactId: contact.id, whatsappInstanceId: instance.id, direction: "INBOUND", body, createdAt: addDays(new Date(), -daysAgo) } });
    await mk("velha", 91);
    await mk("velha2", 120);
    await mk("recente", 89);

    const summary = await runMaintenanceTick(new Date());
    expect(summary.chatMessagesPurged).toBeGreaterThanOrEqual(2);
    const left = await prisma.chatMessage.findMany({ where: { tenantId: tenant.id } });
    expect(left.map((m) => m.body)).toEqual(["recente"]);
  });

  it("anonimização de contato de empresa cancelada há > 90 dias apaga as mensagens do contato", async () => {
    const { tenant, instance } = await makeWorld("anon");
    await prisma.subscription.update({ where: { tenantId: tenant.id }, data: { status: "CANCELED", canceledAt: addDays(new Date(), -100) } });
    const contact = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid(), name: "Fulano" } });
    await seedMessages(tenant.id, contact.id, instance.id, 3, 60_000);

    const summary = await runMaintenanceTick(new Date());
    expect(summary.contactsAnonymized).toBeGreaterThanOrEqual(1);
    expect(await prisma.chatMessage.count({ where: { contactId: contact.id } })).toBe(0);
    expect((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).name).toBeNull();
  });

  it("excluir contato (sem agendamentos) e anonimizar (com agendamentos) apagam as mensagens", async () => {
    const { tenant, instance } = await makeWorld("del");
    const plain = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid(), name: "Sem agenda" } });
    const booked = await prisma.contact.create({ data: { tenantId: tenant.id, waJid: nextJid(), name: "Com agenda" } });
    await seedMessages(tenant.id, plain.id, instance.id, 2, 60_000);
    await seedMessages(tenant.id, booked.id, instance.id, 2, 60_000);

    const service = await prisma.service.create({ data: { tenantId: tenant.id, name: "Corte", durationMin: 30 } });
    const professional = await prisma.professional.create({ data: { tenantId: tenant.id, name: "Ana" } });
    const startsAt = addDays(new Date(), 5);
    await prisma.appointment.create({
      data: {
        tenantId: tenant.id,
        contactId: booked.id,
        serviceId: service.id,
        professionalId: professional.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        blockEndsAt: new Date(startsAt.getTime() + 30 * 60_000),
        source: "PANEL",
      },
    });

    expect(await deleteContact(tenant.id, plain.id)).toEqual({ mode: "deleted" });
    expect(await deleteContact(tenant.id, booked.id)).toEqual({ mode: "anonymized" });
    expect(await prisma.chatMessage.count({ where: { tenantId: tenant.id } })).toBe(0);
  });
});
