/**
 * Cliente da API pública do n8n (`/api/v1`), isolado detrás de uma interface — mesmo padrão de
 * `src/modules/billing/mercadopago.ts` (`MercadoPagoGateway`): o resto do módulo
 * (`n8n-sync.ts`) nunca chama `fetch` direto, para os testes injetarem um mock em vez de bater
 * numa instância real.
 *
 * Superfície confirmada pelo Atlas contra o spec oficial (repo `n8n-io/n8n`, branch `master`,
 * `packages/cli/src/public-api/v1/handlers/**\/spec`, consultado em 2026-09-28) — substitui o
 * levantamento anterior por conhecimento treinado (ver histórico em
 * `.claude/agent-memory/vega/n8n_public_api_no_update_no_list_credentials.md`). Pontos que este
 * cliente trata com fallback, porque a versão do n8n do dono ainda não foi confirmada:
 *   - **Ativar/desativar workflow**: `POST /workflows/{id}/activate`/`.../deactivate` estão
 *     **deprecated**; o substituto é `POST /workflows/{id}/publish`/`.../unpublish`. Este
 *     cliente tenta publish/unpublish primeiro e só cai para activate/deactivate se a instância
 *     responder 404 nessas rotas (versão antiga sem publish/unpublish).
 *   - **Credenciais**: a versão atual do spec tem `GET /credentials`, `GET /credentials/{id}` e
 *     `PATCH /credentials/{id}` (update) além de `POST`/`DELETE` — mas instâncias mais antigas
 *     só tinham `POST`/`DELETE`. Este cliente tenta `PATCH` primeiro; se a instância responder
 *     404/405 (rota inexistente/método não permitido), cai para "deletar o id antigo + criar um
 *     novo" (`n8n-sync.ts#rotateCredential`), que sempre funciona em qualquer versão.
 *   - **`PUT /workflows/{id}`**: exige exatamente `name`, `nodes`, `connections`, `settings` no
 *     corpo — `id`, `active`, `createdAt`, `updatedAt`, `isArchived`, `versionId`,
 *     `triggerCount`, `tags` e `meta` são `readOnly` e este cliente filtra qualquer excesso
 *     antes de enviar (nunca reenvia o objeto cru vindo do `GET`). O query param
 *     `publishIfActive` (padrão `true`) é deixado no padrão — não passamos o parâmetro.
 */

import { safeFetch } from "@/lib/net/safe-fetch";

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
  /** `PATCH /credentials/{id}` — lança `N8nApiError` com `status` 404/405 se a instância não suportar (versão antiga); quem chama decide o fallback. */
  updateCredential(id: string, input: N8nCredentialInput): Promise<N8nCredential>;
  deleteCredential(id: string): Promise<void>;
  getWorkflow(id: string): Promise<N8nWorkflow | null>;
  listWorkflows(): Promise<N8nWorkflow[]>;
  updateWorkflow(id: string, workflow: Pick<N8nWorkflow, "name" | "nodes" | "connections" | "settings">): Promise<N8nWorkflow>;
  /** Tenta `POST /workflows/{id}/publish`; cai para `.../activate` (deprecated) em 404. */
  activateWorkflow(id: string): Promise<void>;
  /** Tenta `POST /workflows/{id}/unpublish`; cai para `.../deactivate` (deprecated) em 404. */
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

/** Chaves de `settings` aceitas pelo `PUT /workflows/{id}` em todas as versões recentes do n8n. */
const STABLE_SETTINGS_KEYS = [
  "saveExecutionProgress",
  "saveManualExecutions",
  "saveDataErrorExecution",
  "saveDataSuccessExecution",
  "executionTimeout",
  "errorWorkflow",
  "timezone",
  "executionOrder",
  "callerPolicy",
  "callerIds",
] as const;

/** O mínimo que o InnoChat configura nos workflows (retenção de execuções, erro, fuso). */
const ESSENTIAL_SETTINGS_KEYS = [
  "saveManualExecutions",
  "saveDataErrorExecution",
  "saveDataSuccessExecution",
  "executionTimeout",
  "errorWorkflow",
  "timezone",
] as const;

function pickSettings(settings: Record<string, unknown> | undefined, keys: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of keys) {
    if (settings && settings[key] !== undefined) picked[key] = settings[key];
  }
  return picked;
}

const REQUEST_TIMEOUT_MS = 10_000;
const WORKFLOWS_LIST_LIMIT = 100;
const WORKFLOWS_LIST_MAX_PAGES = 5; // teto de segurança — nunca varredura ilimitada (docs/arquitetura.md, "nunca todos os registros sem limite")

/**
 * `safeFetch` (não `fetch` direto) — defesa SSRF leve contra `baseUrl` configurado pelo admin
 * (revisão de segurança 2026-09-28, achado MÉDIA; `src/lib/net/safe-fetch.ts`).
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await safeFetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/** Implementação real, contra uma instância n8n de verdade (`baseUrl` já apontando para a raiz, sem `/api/v1`). */
export function createN8nClient(baseUrl: string, apiKey: string): N8nClient {
  const apiBase = `${baseUrl.replace(/\/$/, "")}/api/v1`;
  const headers = { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" };

  async function rawRequest(path: string, init: RequestInit = {}): Promise<Response> {
    return fetchWithTimeout(`${apiBase}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  }

  /** 404 -> null (recurso não existe); outro status não-ok -> lança; 204/2xx sem corpo -> null. */
  async function request<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    const response = await rawRequest(path, init);
    if (response.status === 404) return null;
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new N8nApiError(response.status, `n8n respondeu ${response.status} em ${path}: ${body.slice(0, 300)}`);
    }
    if (response.status === 204) return null;
    return (await response.json()) as T;
  }

  /** Tenta `primaryPath`; se a instância responder 404 (rota não existe nesta versão), tenta `fallbackPath`. */
  async function postWithFallback(primaryPath: string, fallbackPath: string): Promise<void> {
    const response = await rawRequest(primaryPath, { method: "POST" });
    // 404 (rota inexistente) ou 405 ("POST method not allowed", visto no n8n do primeiro deploy
    // real em 2026-09-29): a instância não tem a rota nova, então usa a antiga.
    if (response.status === 404 || response.status === 405) {
      const fallback = await rawRequest(fallbackPath, { method: "POST" });
      if (!fallback.ok && fallback.status !== 204) {
        const body = await fallback.text().catch(() => "");
        throw new N8nApiError(fallback.status, `n8n respondeu ${fallback.status} em ${fallbackPath}: ${body.slice(0, 300)}`);
      }
      return;
    }
    if (!response.ok && response.status !== 204) {
      const body = await response.text().catch(() => "");
      throw new N8nApiError(response.status, `n8n respondeu ${response.status} em ${primaryPath}: ${body.slice(0, 300)}`);
    }
  }

  return {
    async createCredential(input) {
      const created = await request<N8nCredential>("/credentials", { method: "POST", body: JSON.stringify(input) });
      if (!created) throw new N8nApiError(500, "n8n não devolveu a credencial criada.");
      return created;
    },

    async updateCredential(id, input) {
      const response = await rawRequest(`/credentials/${id}`, { method: "PATCH", body: JSON.stringify(input) });
      if (response.status === 404 || response.status === 405) {
        throw new N8nApiError(response.status, `PATCH de credencial não suportado nesta instância (status ${response.status}).`);
      }
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new N8nApiError(response.status, `n8n respondeu ${response.status} em /credentials/${id}: ${body.slice(0, 300)}`);
      }
      return (await response.json()) as N8nCredential;
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
      // `PUT /workflows/{id}` só aceita estes 4 campos — nunca reenviamos o objeto cru do GET
      // (que traz `id`/`active`/`tags`/`versionId`/etc, todos `readOnly`). `publishIfActive`
      // fica no padrão (`true`) — não passamos query param.
      //
      // `settings` também é filtrado: o GET devolve chaves que o schema de escrita da própria
      // instância recusa ("settings must NOT have additional properties", primeiro deploy real,
      // 2026-09-29). Mandamos só as chaves estáveis entre versões; se ainda assim a instância
      // recusar, tenta de novo só com as que o InnoChat realmente usa.
      const send = async (settings: Record<string, unknown>) => {
        const payload = { name: workflow.name, nodes: workflow.nodes, connections: workflow.connections, settings };
        return request<N8nWorkflow>(`/workflows/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      };
      let updated: N8nWorkflow | null;
      try {
        updated = await send(pickSettings(workflow.settings, STABLE_SETTINGS_KEYS));
      } catch (error) {
        if (!(error instanceof N8nApiError && error.status === 400 && /settings/i.test(error.message))) throw error;
        updated = await send(pickSettings(workflow.settings, ESSENTIAL_SETTINGS_KEYS));
      }
      if (!updated) throw new N8nApiError(500, "n8n não devolveu o workflow atualizado.");
      return updated;
    },

    async activateWorkflow(id) {
      await postWithFallback(`/workflows/${id}/publish`, `/workflows/${id}/activate`);
    },

    async deactivateWorkflow(id) {
      await postWithFallback(`/workflows/${id}/unpublish`, `/workflows/${id}/deactivate`);
    },
  };
}
