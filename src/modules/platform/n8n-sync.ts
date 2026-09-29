import { getPrisma } from "@/lib/db/prisma";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getPublicBaseUrl } from "@/lib/public-url";
import { loadPlatformSettingsRow, readGenericSecret } from "./secrets";
import { regenerateInternalApiSecret } from "./service";
import { createN8nClient, N8nApiError, type N8nClient, type N8nNode, type N8nWorkflow } from "./n8n-client";

/**
 * "Sincronizar n8n" (docs/contratos.md — "Configuração pela plataforma"): sobe a URL do
 * painel, a URL da Evolution e as 3 credenciais para o workflow `innochat-bot` (e o error
 * workflow `innochat-erros`), sem nunca ativar nada (`n8n/README.md`, `n8n/innochat-bot.json`
 * são a fonte dos nomes de nó usados abaixo).
 *
 * Idempotente por desenho: credenciais são atualizadas no lugar via `PATCH` quando a instância
 * suporta (mantém o mesmo id); em instâncias antigas sem `PATCH` (404/405), cai para "deletar o
 * id anterior + criar um novo" (`rotateCredential`) e o id novo é regravado em TODO nó que a
 * usa — rodar duas vezes nunca deixa um nó apontando para uma credencial órfã nem duplica nada
 * no n8n, nos dois caminhos. Workflows são atualizados no lugar (PUT no mesmo id), nunca
 * recriados.
 */

// IDs de fábrica documentados em `n8n/README.md` — usados como primeira tentativa antes de
// cair para "achar pelo nome" (ver `resolveWorkflow`/`tryResolveWorkflow`).
const DEFAULT_BOT_WORKFLOW_ID = "levHnMSXf1dOR3gS";
const DEFAULT_ERROS_WORKFLOW_ID = "GZSwTNgvVt4LYnwW";
// `innochat-cron` (n8n/README.md, "innochat-cron" — confirmado pelo Atlas via MCP): diferente
// do bot/erros, este workflow é OPCIONAL — pode não existir ainda em instâncias mais antigas do
// dono, e a sync nunca falha por isso (ver `tryResolveWorkflow`, sem lançar).
const DEFAULT_CRON_WORKFLOW_ID = "dPMhT4MqGglCpFSw";
const CRON_WORKFLOW_NAME = "innochat-cron";

const CRED_PAINEL_NAME = "InnoChat Painel (Bearer)";
const CRED_EVOLUTION_NAME = "Evolution API (apikey)";
const CRED_N8N_API_NAME = "n8n API (X-N8N-API-KEY)";

const CONFIG_NODE_NAME = "Config";
const CONFIG_ERROS_NODE_NAME = "Config erros";
const CONFIG_CRON_NODE_NAME = "Config cron";

export type N8nSyncSummary = {
  painelUrl: string;
  botWorkflowId: string | null;
  errosWorkflowId: string | null;
  /** `null` quando `innochat-cron` não foi encontrado nesta sincronização — ver `warnings`. */
  cronWorkflowId: string | null;
  credentialsRotated: number;
  nodesRebound: number;
  /** Avisos que não impedem a sync de terminar (ex.: `innochat-cron` ausente). */
  warnings: string[];
};

type PlatformN8nConfig = {
  n8nBaseUrl: string;
  n8nApiKey: string;
  evolutionApiUrl: string;
  evolutionApiKey: string;
};

async function loadConfigOrThrow(): Promise<PlatformN8nConfig> {
  const row = await loadPlatformSettingsRow(); // já migrado; chaves decifradas abaixo
  const settings = {
    n8nBaseUrl: row?.n8nBaseUrl ?? null,
    n8nApiKey: readGenericSecret(row?.n8nApiKey, "n8nApiKey"),
    evolutionApiUrl: row?.evolutionApiUrl ?? null,
    evolutionApiKey: readGenericSecret(row?.evolutionApiKey, "evolutionApiKey"),
  };
  if (!settings?.n8nBaseUrl || !settings.n8nApiKey) {
    throw new DomainError("N8N_NOT_CONFIGURED", "Configure a URL e a API key do n8n em Admin > Configurações antes de sincronizar.");
  }
  if (!settings.evolutionApiUrl || !settings.evolutionApiKey) {
    throw new DomainError("EVOLUTION_NOT_CONFIGURED", "Configure a URL e a API key da Evolution antes de sincronizar.");
  }
  return {
    n8nBaseUrl: settings.n8nBaseUrl,
    n8nApiKey: settings.n8nApiKey,
    evolutionApiUrl: settings.evolutionApiUrl,
    evolutionApiKey: settings.evolutionApiKey,
  };
}

/** Classifica um nó HTTP Request pela URL que ele chama — evita depender de uma lista de nomes fixa que quebra se um nó novo for adicionado ao workflow. */
function classifyCredentialGroup(node: N8nNode): "painel" | "evolution" | "n8n" | null {
  if (node.type !== "n8n-nodes-base.httpRequest") return null;
  const params = (node.parameters ?? {}) as Record<string, unknown>;
  if (params.authentication !== "genericCredentialType" || params.genericAuthType !== "httpHeaderAuth") return null;
  const url = String(params.url ?? "");
  if (url.includes("evolutionUrl")) return "evolution";
  if (url.includes("n8nApiUrl")) return "n8n";
  if (url.includes("painelUrl")) return "painel";
  return null;
}

function setConfigAssignment(node: N8nNode, name: string, value: string): void {
  const params = (node.parameters ?? {}) as { assignments?: { assignments?: Array<{ name: string; value: unknown }> } };
  const assignment = params.assignments?.assignments?.find((a) => a.name === name);
  if (assignment) assignment.value = value;
}

/**
 * Atualiza a credencial existente via `PATCH` (mesmo id, instância nova); se a instância não
 * suportar `PATCH` (404/405 — versão antiga do n8n), cai para "deletar o id antigo + criar um
 * novo" — o único caminho que sempre funciona, em qualquer versão. Sem `previousId`, cria
 * direto. Nunca deixa duas credenciais vigentes para o mesmo propósito.
 */
/**
 * Versões recentes do n8n exigem, na API pública, a restrição de domínio da credencial
 * (`allowedHttpRequestDomains` + `allowedDomains`: "requires property allowedDomains" no primeiro
 * deploy real, 2026-09-29). Restringir a credencial ao host que ela de fato chama também é o mais
 * seguro. Versões antigas recusam essas propriedades ("additional property"): aí reenvia sem elas.
 */
function isDomainFieldsRejected(error: unknown): boolean {
  return error instanceof N8nApiError && error.status === 400 && /additional propert/i.test(error.message) && /allowed/i.test(error.message);
}

async function withDomainFieldsFallback<T>(
  data: Record<string, string>,
  allowedHost: string,
  send: (payload: Record<string, string>) => Promise<T>,
): Promise<T> {
  try {
    return await send({ ...data, allowedHttpRequestDomains: "domains", allowedDomains: allowedHost });
  } catch (error) {
    if (!isDomainFieldsRejected(error)) throw error;
    logger.info("platform.n8n_sync.domain_fields_unsupported");
    return send(data);
  }
}

async function rotateCredential(
  client: N8nClient,
  previousId: string | null,
  name: string,
  type: string,
  data: Record<string, string>,
  allowedHost: string,
): Promise<string> {
  if (previousId) {
    try {
      const updated = await withDomainFieldsFallback(data, allowedHost, (payload) =>
        client.updateCredential(previousId, { name, type, data: payload }),
      );
      return updated.id;
    } catch (error) {
      if (!(error instanceof N8nApiError) || (error.status !== 404 && error.status !== 405)) {
        throw error;
      }
      logger.info("platform.n8n_sync.credential_patch_unsupported", { name, status: error.status });
      await client.deleteCredential(previousId).catch((deleteError) => {
        logger.warn("platform.n8n_sync.delete_credential_failed", {
          name,
          errorMessage: deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      });
    }
  }
  const created = await withDomainFieldsFallback(data, allowedHost, (payload) => client.createCredential({ name, type, data: payload }));
  return created.id;
}

async function resolveWorkflow(client: N8nClient, storedId: string | null, defaultId: string, name: string): Promise<N8nWorkflow> {
  const byId = await client.getWorkflow(storedId ?? defaultId);
  if (byId) return byId;

  const all = await client.listWorkflows();
  const byName = all.find((w) => w.name === name);
  if (!byName) {
    throw new DomainError("N8N_WORKFLOW_NOT_FOUND", `Workflow "${name}" não encontrado no n8n. Importe ${name}.json (ver n8n/README.md).`);
  }
  return byName;
}

/**
 * Igual a `resolveWorkflow`, mas NUNCA lança — usada para `innochat-cron` (opcional): instância
 * mais antiga do dono pode não ter esse workflow importado ainda, e isso não deve derrubar o
 * resto da sincronização (mission: "se o workflow não existir, a sync não falha; só avisa").
 */
async function tryResolveWorkflow(client: N8nClient, storedId: string | null, defaultId: string, name: string): Promise<N8nWorkflow | null> {
  const byId = await client.getWorkflow(storedId ?? defaultId);
  if (byId) return byId;

  const all = await client.listWorkflows();
  return all.find((w) => w.name === name) ?? null;
}

function rebindHttpCredentials(workflow: N8nWorkflow, ids: { painel: string; evolution: string; n8n: string }): number {
  let rebound = 0;
  for (const node of workflow.nodes) {
    const group = classifyCredentialGroup(node);
    if (!group) continue;
    const id = group === "painel" ? ids.painel : group === "evolution" ? ids.evolution : ids.n8n;
    const name = group === "painel" ? CRED_PAINEL_NAME : group === "evolution" ? CRED_EVOLUTION_NAME : CRED_N8N_API_NAME;
    node.credentials = { httpHeaderAuth: { id, name } };
    rebound += 1;
  }
  return rebound;
}

/** `docs/contratos.md` — orquestra tudo. Nunca ativa workflow (ação separada, ver `activateBotWorkflow`). */
export async function syncN8n(updatedByUserId: string): Promise<N8nSyncSummary> {
  const config = await loadConfigOrThrow();
  const prisma = getPrisma();
  const client = createN8nClient(config.n8nBaseUrl, config.n8nApiKey);

  const painelUrl = `${await getPublicBaseUrl()}/api/internal/v1`;

  const current = await prisma.platformSettings.findUnique({
    where: { id: 1 },
    select: {
      n8nCredPainelId: true,
      n8nCredEvolutionId: true,
      n8nCredApiId: true,
      n8nWorkflowBotId: true,
      n8nWorkflowErrosId: true,
      n8nWorkflowCronId: true,
    },
  });

  // O segredo interno em texto puro só existe no instante em que é gerado (só guardamos o
  // hash) — a sync sempre gera um novo para poder mandá-lo ao n8n, sem nunca exibi-lo na UI.
  const { secret: internalApiSecret } = await regenerateInternalApiSecret(updatedByUserId);

  const painelCredId = await rotateCredential(client, current?.n8nCredPainelId ?? null, CRED_PAINEL_NAME, "httpHeaderAuth", {
    name: "Authorization",
    value: `Bearer ${internalApiSecret}`,
  }, new URL(painelUrl).hostname);
  const evolutionCredId = await rotateCredential(client, current?.n8nCredEvolutionId ?? null, CRED_EVOLUTION_NAME, "httpHeaderAuth", {
    name: "apikey",
    value: config.evolutionApiKey,
  }, new URL(config.evolutionApiUrl).hostname);
  const n8nCredId = await rotateCredential(client, current?.n8nCredApiId ?? null, CRED_N8N_API_NAME, "httpHeaderAuth", {
    name: "X-N8N-API-KEY",
    value: config.n8nApiKey,
  }, new URL(config.n8nBaseUrl).hostname);

  const botWorkflow = await resolveWorkflow(client, current?.n8nWorkflowBotId ?? null, DEFAULT_BOT_WORKFLOW_ID, "innochat-bot");
  const configNode = botWorkflow.nodes.find((n) => n.name === CONFIG_NODE_NAME);
  if (configNode) {
    setConfigAssignment(configNode, "painelUrl", painelUrl);
    setConfigAssignment(configNode, "evolutionUrl", config.evolutionApiUrl.replace(/\/$/, ""));
  }
  const botRebound = rebindHttpCredentials(botWorkflow, { painel: painelCredId, evolution: evolutionCredId, n8n: n8nCredId });
  await client.updateWorkflow(botWorkflow.id, {
    name: botWorkflow.name,
    nodes: botWorkflow.nodes,
    connections: botWorkflow.connections,
    settings: botWorkflow.settings,
  });

  const errosWorkflow = await resolveWorkflow(client, current?.n8nWorkflowErrosId ?? null, DEFAULT_ERROS_WORKFLOW_ID, "innochat-erros");
  const configErrosNode = errosWorkflow.nodes.find((n) => n.name === CONFIG_ERROS_NODE_NAME);
  if (configErrosNode) {
    setConfigAssignment(configErrosNode, "n8nApiUrl", `${config.n8nBaseUrl.replace(/\/$/, "")}/api/v1`);
  }
  const errosRebound = rebindHttpCredentials(errosWorkflow, { painel: painelCredId, evolution: evolutionCredId, n8n: n8nCredId });
  await client.updateWorkflow(errosWorkflow.id, {
    name: errosWorkflow.name,
    nodes: errosWorkflow.nodes,
    connections: errosWorkflow.connections,
    settings: errosWorkflow.settings,
  });

  // `innochat-cron` (opcional, ver `tryResolveWorkflow`): só chama `POST /billing/tick` com a
  // credencial do painel — não conhece Evolution nem n8n API, então só reata o grupo "painel".
  const warnings: string[] = [];
  const cronWorkflow = await tryResolveWorkflow(client, current?.n8nWorkflowCronId ?? null, DEFAULT_CRON_WORKFLOW_ID, CRON_WORKFLOW_NAME);
  let cronRebound = 0;
  if (cronWorkflow) {
    const configCronNode = cronWorkflow.nodes.find((n) => n.name === CONFIG_CRON_NODE_NAME);
    if (configCronNode) {
      setConfigAssignment(configCronNode, "painelUrl", painelUrl);
    }
    cronRebound = rebindHttpCredentials(cronWorkflow, { painel: painelCredId, evolution: evolutionCredId, n8n: n8nCredId });
    await client.updateWorkflow(cronWorkflow.id, {
      name: cronWorkflow.name,
      nodes: cronWorkflow.nodes,
      connections: cronWorkflow.connections,
      settings: cronWorkflow.settings,
    });
  } else {
    warnings.push(`Workflow "${CRON_WORKFLOW_NAME}" não encontrado no n8n — importe-o para a cobrança automática (POST /billing/tick) funcionar.`);
  }

  await prisma.platformSettings.update({
    where: { id: 1 },
    data: {
      n8nCredPainelId: painelCredId,
      n8nCredEvolutionId: evolutionCredId,
      n8nCredApiId: n8nCredId,
      n8nWorkflowBotId: botWorkflow.id,
      n8nWorkflowErrosId: errosWorkflow.id,
      // Preserva o id anterior se este round não achou o cron (transitório) — só grava um id
      // novo/confirmado; nunca apaga uma referência válida por causa de uma falha passageira.
      ...(cronWorkflow ? { n8nWorkflowCronId: cronWorkflow.id } : {}),
    },
  });

  logger.info("platform.n8n_sync.completed", {
    botWorkflowId: botWorkflow.id,
    errosWorkflowId: errosWorkflow.id,
    cronWorkflowId: cronWorkflow?.id ?? null,
  });

  return {
    painelUrl,
    botWorkflowId: botWorkflow.id,
    errosWorkflowId: errosWorkflow.id,
    cronWorkflowId: cronWorkflow?.id ?? null,
    credentialsRotated: 3,
    nodesRebound: botRebound + errosRebound + cronRebound,
    warnings,
  };
}

async function setWorkflowActive(which: "bot" | "erros" | "cron", active: boolean): Promise<void> {
  const config = await loadConfigOrThrow();
  const client = createN8nClient(config.n8nBaseUrl, config.n8nApiKey);
  const settings = await getPrisma().platformSettings.findUnique({
    where: { id: 1 },
    select: { n8nWorkflowBotId: true, n8nWorkflowErrosId: true, n8nWorkflowCronId: true },
  });
  const id =
    which === "bot" ? settings?.n8nWorkflowBotId : which === "erros" ? settings?.n8nWorkflowErrosId : settings?.n8nWorkflowCronId;
  if (!id) {
    // `cron` é opcional (mission: workflow pode não existir ainda na instância do dono) — nunca
    // bloqueia "Ativar bot" por causa disso, só pula silenciosamente.
    if (which === "cron") return;
    throw new DomainError("N8N_NOT_SYNCED", "Sincronize o n8n antes de ativar/desativar o bot.");
  }
  if (active) {
    await client.activateWorkflow(id);
  } else {
    await client.deactivateWorkflow(id);
  }
}

/**
 * Ação separada de "Ativar bot" (docs/contratos.md — a sync nunca ativa sozinha). Publica o
 * `innochat-cron` JUNTO com o bot (mission: "publicar/ativar o cron junto com 'Ativar bot'") —
 * sem cron sincronizado ainda, só pula essa parte (ver `setWorkflowActive`).
 */
export async function activateBotWorkflow(): Promise<void> {
  await setWorkflowActive("bot", true);
  await setWorkflowActive("cron", true);
}

export async function deactivateBotWorkflow(): Promise<void> {
  await setWorkflowActive("bot", false);
  await setWorkflowActive("cron", false);
}
