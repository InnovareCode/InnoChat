/**
 * Teste de envio interativo do admin (botões / lista / enquete): seleção de instância elegível,
 * validação de telefone, e devolução de status/corpo sem guardar o número. Evolution FAKE.
 */
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import { EvolutionApiError, type EvolutionClient } from "@/modules/whatsapp/evolution-client";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const prisma = getPrisma();
const { auth } = await import("@/lib/auth");
const { sendInteractiveTest, listTestableInstances } = await import("@/modules/whatsapp/interactive-test");
const { sendInteractiveTestAction } = await import("@/modules/whatsapp/interactive-test-actions");

const createdTenantIds: string[] = [];
const createdUserIds: string[] = [];

afterEach(() => {
  vi.mocked(auth).mockReset();
});

afterAll(async () => {
  await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

function fakeClient(overrides: Partial<EvolutionClient> = {}): EvolutionClient {
  return {
    sendButtons: vi.fn(async () => ({ messageId: "M1", status: 201, body: { key: { id: "M1" } } })),
    sendList: vi.fn(async () => ({ messageId: "M2", status: 201, body: { key: { id: "M2" } } })),
    sendPoll: vi.fn(async () => ({ messageId: "M3", status: 201, body: { key: { id: "M3" } } })),
    ...overrides,
  } as unknown as EvolutionClient;
}

async function createTenantWithInstance(opts: { status?: "CONNECTED" | "QRCODE"; sandbox?: boolean }) {
  const suffix = randomUUID().slice(0, 8);
  const tenant = await prisma.tenant.create({ data: { slug: `it-itest-${suffix}`, name: `Teste Interativo ${suffix}`, timezone: "UTC" } });
  createdTenantIds.push(tenant.id);
  const instance = await prisma.whatsappInstance.create({
    data: {
      tenantId: tenant.id,
      instanceName: `innochat-it-${suffix}`,
      label: "Principal",
      status: opts.status ?? "CONNECTED",
      sandbox: opts.sandbox ?? false,
      webhookToken: randomUUID(),
    },
  });
  return { tenant, instance };
}

describe("sendInteractiveTest", () => {
  it("envia botões pela instância conectada, com ids numéricos, e devolve status/corpo sem o número inteiro", async () => {
    const { instance } = await createTenantWithInstance({});
    const client = fakeClient();

    const result = await sendInteractiveTest({ instanceId: instance.id, to: "(11) 91234-5678", kind: "buttons" }, { client });

    expect(client.sendButtons).toHaveBeenCalledWith(instance.instanceName, "5511912345678", expect.objectContaining({
      buttons: [
        { type: "reply", displayText: "Corte", id: "1" },
        { type: "reply", displayText: "Escova", id: "2" },
        { type: "reply", displayText: "Coloração", id: "3" },
      ],
    }));
    expect(result).toMatchObject({ accepted: true, status: 201, kind: "buttons" });
    expect(JSON.stringify(result)).not.toContain("5511912345678");
    expect(result.sentPayloadNote).toContain("***5678");
  });

  it("por tenantSlug escolhe a instância conectada não-sandbox, e enquete numera as opções", async () => {
    const { tenant, instance } = await createTenantWithInstance({});
    const client = fakeClient();

    await sendInteractiveTest({ tenantSlug: tenant.slug, to: "11912345678", kind: "poll" }, { client });

    expect(client.sendPoll).toHaveBeenCalledWith(instance.instanceName, "5511912345678", {
      name: "Qual serviço você quer?",
      selectableCount: 1,
      values: ["1 - Corte", "2 - Escova", "3 - Coloração"],
    });
  });

  it("recusa instância sandbox e instância desconectada", async () => {
    const sandbox = await createTenantWithInstance({ sandbox: true });
    const offline = await createTenantWithInstance({ status: "QRCODE" });
    const client = fakeClient();

    await expect(sendInteractiveTest({ instanceId: sandbox.instance.id, to: "11912345678", kind: "list" }, { client })).rejects.toMatchObject({ code: "INSTANCE_SANDBOX" });
    await expect(sendInteractiveTest({ instanceId: offline.instance.id, to: "11912345678", kind: "list" }, { client })).rejects.toMatchObject({ code: "INSTANCE_NOT_CONNECTED" });
    expect(client.sendList).not.toHaveBeenCalled();
  });

  it("telefone inválido e entrada sem instância/tenant são rejeitados antes de enviar", async () => {
    const { instance } = await createTenantWithInstance({});
    const client = fakeClient();

    await expect(sendInteractiveTest({ instanceId: instance.id, to: "12345", kind: "buttons" }, { client })).rejects.toBeTruthy();
    await expect(sendInteractiveTest({ to: "11912345678", kind: "buttons" }, { client })).rejects.toBeTruthy();
    expect(client.sendButtons).not.toHaveBeenCalled();
  });

  it("erro da Evolution vira resultado accepted:false com status e corpo do erro (não lança)", async () => {
    const { instance } = await createTenantWithInstance({});
    const client = fakeClient({
      sendList: vi.fn(async () => {
        throw new EvolutionApiError("Evolution API respondeu 400", 400, undefined, '{"response":{"message":["Bad Request"]}}');
      }),
    });

    const result = await sendInteractiveTest({ instanceId: instance.id, to: "11912345678", kind: "list" }, { client });

    expect(result).toMatchObject({ accepted: false, status: 400 });
    expect(result.responseBody).toContain("Bad Request");
  });

  it("listTestableInstances só traz conectadas, não-sandbox", async () => {
    const ok = await createTenantWithInstance({});
    const sandbox = await createTenantWithInstance({ sandbox: true });
    const ids = (await listTestableInstances()).map((i) => i.id);
    expect(ids).toContain(ok.instance.id);
    expect(ids).not.toContain(sandbox.instance.id);
  });
});

describe("sendInteractiveTestAction — permissão", () => {
  it("usuário que não é admin da plataforma recebe FORBIDDEN", async () => {
    const user = await prisma.user.create({ data: { email: `it-itest-${randomUUID()}@example.com`, passwordHash: "x", emailVerifiedAt: new Date() } });
    createdUserIds.push(user.id);
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const result = await sendInteractiveTestAction({ instanceId: "x", to: "11912345678", kind: "buttons" });

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
