/**
 * `syncN8n` (docs/contratos.md, `src/modules/platform/n8n-sync.ts`) contra Postgres real, com
 * `fetch` mockado simulando a API pública do n8n (não temos uma instância real disponível
 * nesta sessão — ver PENDÊNCIA registrada em `n8n-client.ts`/`docs/contratos.md`). Prova:
 * idempotência (rodar 2x não duplica credencial nem workflow) e que os nós HTTP corretos
 * recebem a credencial certa.
 */
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/db/prisma";
import type { N8nNode, N8nWorkflow } from "@/modules/platform/n8n-client";

const prisma = getPrisma();

const N8N_BASE_URL = "https://n8n.example.test";
const EVOLUTION_URL = "https://evolution.example.test";

function makeBotWorkflow(): N8nWorkflow {
  const nodes: N8nNode[] = [
    {
      name: "Config",
      type: "n8n-nodes-base.set",
      parameters: {
        assignments: {
          assignments: [
            { id: "painelUrl", name: "painelUrl", value: "https://PAINEL_A_DEFINIR/api/internal/v1", type: "string" },
            { id: "evolutionUrl", name: "evolutionUrl", value: "https://EVOLUTION_A_DEFINIR", type: "string" },
          ],
        },
      },
    },
    {
      name: "Claim",
      type: "n8n-nodes-base.httpRequest",
      parameters: { authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth", url: "={{ $('Config').first().json.painelUrl }}/messages/claim" },
    },
    {
      name: "Enviar pela Evolution",
      type: "n8n-nodes-base.httpRequest",
      parameters: { authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth", url: "={{ $('Config').first().json.evolutionUrl }}/message/sendText/x" },
    },
  ];
  return { id: "levHnMSXf1dOR3gS", name: "innochat-bot", active: false, nodes, connections: {} };
}

function makeErrosWorkflow(): N8nWorkflow {
  const nodes: N8nNode[] = [
    {
      name: "Config erros",
      type: "n8n-nodes-base.set",
      parameters: { assignments: { assignments: [{ id: "n8nApiUrl", name: "n8nApiUrl", value: "https://N8N_A_DEFINIR/api/v1", type: "string" }] } },
    },
    {
      name: "Buscar execução com falha",
      type: "n8n-nodes-base.httpRequest",
      parameters: { authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth", url: "={{ $('Config erros').first().json.n8nApiUrl }}/executions/1" },
    },
    {
      name: "Liberar trava",
      type: "n8n-nodes-base.httpRequest",
      parameters: { authentication: "genericCredentialType", genericAuthType: "httpHeaderAuth", url: "={{ $('Config erros').first().json.painelUrl }}/sessions/unlock" },
    },
  ];
  return { id: "GZSwTNgvVt4LYnwW", name: "innochat-erros", active: false, nodes, connections: {} };
}

/** Simula a API pública do n8n: credenciais só têm POST/DELETE (sem update nem list), workflows têm GET/PUT. */
function createFakeN8nServer() {
  let credentialCounter = 0;
  const deletedCredentialIds = new Set<string>();
  const createdCredentials: Array<{ id: string; name: string; type: string; data: Record<string, string> }> = [];
  const workflows = new Map<string, N8nWorkflow>([
    ["levHnMSXf1dOR3gS", makeBotWorkflow()],
    ["GZSwTNgvVt4LYnwW", makeErrosWorkflow()],
  ]);

  const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;

    if (path === "/api/v1/credentials" && method === "POST") {
      credentialCounter += 1;
      const body = JSON.parse(String(init?.body)) as { name: string; type: string; data: Record<string, string> };
      const id = `cred-${credentialCounter}`;
      createdCredentials.push({ id, ...body });
      return jsonResponse(200, { id, name: body.name });
    }

    const credentialDeleteMatch = path.match(/^\/api\/v1\/credentials\/(.+)$/);
    if (credentialDeleteMatch && method === "DELETE") {
      deletedCredentialIds.add(credentialDeleteMatch[1]!);
      return jsonResponse(200, {});
    }

    const workflowMatch = path.match(/^\/api\/v1\/workflows\/([^/]+)$/);
    if (workflowMatch && method === "GET") {
      const wf = workflows.get(workflowMatch[1]!);
      if (!wf) return jsonResponse(404, {});
      return jsonResponse(200, wf);
    }
    if (workflowMatch && method === "PUT") {
      const id = workflowMatch[1]!;
      const body = JSON.parse(String(init?.body)) as Pick<N8nWorkflow, "name" | "nodes" | "connections" | "settings">;
      const existing = workflows.get(id);
      if (!existing) return jsonResponse(404, {});
      const updated: N8nWorkflow = { ...existing, ...body };
      workflows.set(id, updated);
      return jsonResponse(200, updated);
    }

    throw new Error(`fake n8n server: rota não simulada ${method} ${path}`);
  });

  function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  return { fetchMock, createdCredentials, deletedCredentialIds, workflows };
}

const createdUserIds: string[] = [];

beforeEach(async () => {
  await prisma.platformSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      n8nBaseUrl: N8N_BASE_URL,
      n8nApiKey: "fake-n8n-key",
      evolutionApiUrl: EVOLUTION_URL,
      evolutionApiKey: "fake-evolution-key",
      n8nCredPainelId: null,
      n8nCredEvolutionId: null,
      n8nCredApiId: null,
      n8nWorkflowBotId: null,
      n8nWorkflowErrosId: null,
    },
    update: {
      n8nBaseUrl: N8N_BASE_URL,
      n8nApiKey: "fake-n8n-key",
      evolutionApiUrl: EVOLUTION_URL,
      evolutionApiKey: "fake-evolution-key",
      n8nCredPainelId: null,
      n8nCredEvolutionId: null,
      n8nCredApiId: null,
      n8nWorkflowBotId: null,
      n8nWorkflowErrosId: null,
    },
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

async function makeAdminUser() {
  const email = `it-n8n-sync-${Date.now()}-${randomUUID().slice(0, 6)}@example.com`;
  const admin = await prisma.user.create({ data: { email, passwordHash: "x", isPlatformAdmin: true } });
  createdUserIds.push(admin.id);
  return admin;
}

describe("syncN8n — sincronização idempotente com o n8n", () => {
  it("cria as 3 credenciais, atualiza os dois workflows e reata a credencial certa em cada nó HTTP", async () => {
    const { syncN8n } = await import("@/modules/platform/n8n-sync");
    const admin = await makeAdminUser();
    const server = createFakeN8nServer();
    vi.stubGlobal("fetch", server.fetchMock);

    const summary = await syncN8n(admin.id);

    expect(summary.botWorkflowId).toBe("levHnMSXf1dOR3gS");
    expect(summary.errosWorkflowId).toBe("GZSwTNgvVt4LYnwW");
    expect(summary.credentialsRotated).toBe(3);
    expect(server.createdCredentials).toHaveLength(3);
    expect(server.createdCredentials.map((c) => c.name).sort()).toEqual(
      ["Evolution API (apikey)", "InnoChat Painel (Bearer)", "n8n API (X-N8N-API-KEY)"].sort(),
    );

    const botWorkflow = server.workflows.get("levHnMSXf1dOR3gS")!;
    const claimNode = botWorkflow.nodes.find((n) => n.name === "Claim")!;
    const evolutionNode = botWorkflow.nodes.find((n) => n.name === "Enviar pela Evolution")!;
    const painelCred = server.createdCredentials.find((c) => c.name === "InnoChat Painel (Bearer)")!;
    const evolutionCred = server.createdCredentials.find((c) => c.name === "Evolution API (apikey)")!;
    expect(claimNode.credentials?.httpHeaderAuth.id).toBe(painelCred.id);
    expect(evolutionNode.credentials?.httpHeaderAuth.id).toBe(evolutionCred.id);

    const errosWorkflow = server.workflows.get("GZSwTNgvVt4LYnwW")!;
    const execNode = errosWorkflow.nodes.find((n) => n.name === "Buscar execução com falha")!;
    const n8nCred = server.createdCredentials.find((c) => c.name === "n8n API (X-N8N-API-KEY)")!;
    expect(execNode.credentials?.httpHeaderAuth.id).toBe(n8nCred.id);

    const configNode = botWorkflow.nodes.find((n) => n.name === "Config")!;
    const painelUrlAssignment = (configNode.parameters as { assignments: { assignments: Array<{ name: string; value: unknown }> } }).assignments
      .assignments.find((a) => a.name === "painelUrl")!;
    expect(String(painelUrlAssignment.value)).toContain("/api/internal/v1");

    const settings = await prisma.platformSettings.findUnique({ where: { id: 1 } });
    expect(settings?.n8nCredPainelId).toBe(painelCred.id);
    expect(settings?.n8nWorkflowBotId).toBe("levHnMSXf1dOR3gS");
  });

  it("rodar 2x não duplica credencial — a 2ª sync deleta a credencial anterior antes de criar outra", async () => {
    const { syncN8n } = await import("@/modules/platform/n8n-sync");
    const admin = await makeAdminUser();
    const server = createFakeN8nServer();
    vi.stubGlobal("fetch", server.fetchMock);

    await syncN8n(admin.id);
    const firstPainelCredId = (await prisma.platformSettings.findUnique({ where: { id: 1 } }))!.n8nCredPainelId;

    await syncN8n(admin.id);
    const secondPainelCredId = (await prisma.platformSettings.findUnique({ where: { id: 1 } }))!.n8nCredPainelId;

    // 3 credenciais criadas por sync × 2 syncs = 6 criadas no total, mas as 3 da primeira rodada
    // foram deletadas antes da segunda criar as novas — nunca duas vigentes para o mesmo propósito.
    expect(server.createdCredentials).toHaveLength(6);
    expect(firstPainelCredId).not.toBe(secondPainelCredId);
    expect(server.deletedCredentialIds.has(firstPainelCredId!)).toBe(true);

    // Workflow nunca é recriado — mesmo id nas duas rodadas.
    expect(server.workflows.size).toBe(2);
  });

  it("nunca ativa nenhum workflow (fica sempre `active: false`)", async () => {
    const { syncN8n } = await import("@/modules/platform/n8n-sync");
    const admin = await makeAdminUser();
    const server = createFakeN8nServer();
    vi.stubGlobal("fetch", server.fetchMock);

    await syncN8n(admin.id);

    expect(server.workflows.get("levHnMSXf1dOR3gS")!.active).toBe(false);
    expect(server.workflows.get("GZSwTNgvVt4LYnwW")!.active).toBe(false);
  });
});
