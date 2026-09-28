/**
 * Cliente da API pública do n8n (`/api/v1`), isolado detrás de uma interface — mesmo padrão de
 * `src/modules/billing/mercadopago.ts` (`MercadoPagoGateway`): o resto do módulo
 * (`n8n-sync.ts`) nunca chama `fetch` direto, para os testes injetarem um mock em vez de bater
 * numa instância real.
 *
 * IMPORTANTE (registrar no handoff): a superfície abaixo é o conhecimento treinado sobre a API
 * pública do n8n (`/api/v1`, autenticação por header `X-N8N-API-KEY`) — esta sessão não tem
 * acesso à internet para confirmar contra a documentação ao vivo da versão exata do n8n do
 * dono. Pontos que dependem disso e precisam ser confirmados antes do primeiro uso real:
 *   - Credenciais: só `POST /credentials` (criar) e `DELETE /credentials/{id}` são expostos
 *     pela API pública — NÃO há `GET /credentials` (listar) nem `PUT`/`PATCH` (atualizar) por
 *     desenho do n8n (dado de credencial é só-escrita, para não permitir exfiltração via API).
 *     Por isso a "atualização" de uma credencial aqui é DELETE + POST (recriar), e o novo id
 *     tem que ser regravado em todo nó que a referencia — é o que `n8n-sync.ts` faz.
 *   - Workflows: `GET /workflows` (lista, paginado por `cursor`), `GET /workflows/{id}`,
 *     `PUT /workflows/{id}` (substitui `name`/`nodes`/`connections`/`settings` — exige o corpo
 *     inteiro, não faz merge parcial), `POST /workflows/{id}/activate` e `.../deactivate`.
 */

export type N8nCredentialInput = {
  name: string;
  type: string; // ex.: "httpHeaderAuth"
  data: Record<string, string>;
};

export type N8nCredential = { id: string; name: string };

export type N8nNode = {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position?: [number, number];
  parameters?: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  [key: string]: unknown;
};

export type N8nWorkflow = {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  staticData?: unknown;
};

export interface N8nClient {
  createCredential(input: N8nCredentialInput): Promise<N8nCredential>;
  deleteCredential(id: string): Promise<void>;
  getWorkflow(id: string): Promise<N8nWorkflow | null>;
  listWorkflows(): Promise<N8nWorkflow[]>;
  updateWorkflow(id: string, workflow: Pick<N8nWorkflow, "name" | "nodes" | "connections" | "settings">): Promise<N8nWorkflow>;
  activateWorkflow(id: string): Promise<void>;
  deactivateWorkflow(id: string): Promise<void>;
}

export class N8nApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "N8nApiError";
  }
}

const REQUEST_TIMEOUT_MS = 10_000;
const WORKFLOWS_LIST_LIMIT = 100;
const WORKFLOWS_LIST_MAX_PAGES = 5; // teto de segurança — nunca varredura ilimitada (docs/arquitetura.md, "nunca todos os registros sem limite")

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Implementação real, contra uma instância n8n de verdade (`baseUrl` já apontando para a raiz, sem `/api/v1`). */
export function createN8nClient(baseUrl: string, apiKey: string): N8nClient {
  const apiBase = `${baseUrl.replace(/\/$/, "")}/api/v1`;
  const headers = { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" };

  async function request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    const response = await fetchWithTimeout(`${apiBase}${path}`, { ...init, headers: { ...headers, ...init.headers } });
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new N8nApiError(response.status, `n8n respondeu ${response.status} em ${path}: ${body.slice(0, 300)}`);
    }
    if (response.status === 204) return null;
    return (await response.json()) as T;
  }

  return {
    async createCredential(input) {
      const created = await request<N8nCredential>("/credentials", { method: "POST", body: JSON.stringify(input) });
      if (!created) throw new N8nApiError(500, "n8n não devolveu a credencial criada.");
      return created;
    },

    async deleteCredential(id) {
      try {
        await request(`/credentials/${id}`, { method: "DELETE" });
      } catch (error) {
        // Idempotência: credencial já removida (id de uma sincronização anterior perdida) não é erro.
        if (error instanceof N8nApiError && error.status === 404) return;
        throw error;
      }
    },

    async getWorkflow(id) {
      return request<N8nWorkflow>(`/workflows/${id}`, { method: "GET" });
    },

    async listWorkflows() {
      const all: N8nWorkflow[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < WORKFLOWS_LIST_MAX_PAGES; page++) {
        const qs = new URLSearchParams({ limit: String(WORKFLOWS_LIST_LIMIT) });
        if (cursor) qs.set("cursor", cursor);
        const result = await request<{ data: N8nWorkflow[]; nextCursor: string | null }>(`/workflows?${qs.toString()}`, { method: "GET" });
        if (!result) break;
        all.push(...result.data);
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
      }
      return all;
    },

    async updateWorkflow(id, workflow) {
      const updated = await request<N8nWorkflow>(`/workflows/${id}`, { method: "PUT", body: JSON.stringify(workflow) });
      if (!updated) throw new N8nApiError(500, "n8n não devolveu o workflow atualizado.");
      return updated;
    },

    async activateWorkflow(id) {
      await request(`/workflows/${id}/activate`, { method: "POST" });
    },

    async deactivateWorkflow(id) {
      await request(`/workflows/${id}/deactivate`, { method: "POST" });
    },
  };
}
