import { getPrisma } from "@/lib/db/prisma";
import { verifyInternalApiSecret } from "@/modules/platform/service";

/**
 * Erro da API interna (n8n → painel, docs/arquitetura.md §6.1). Diferente de `DomainError`
 * (src/lib/errors.ts, pensado para `Result<T>` de Server Actions): este já carrega o status
 * HTTP, porque a API interna responde JSON de verdade, não `Result<T>`.
 */
export class InternalApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "InternalApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = "Recurso não encontrado."): never {
  throw new InternalApiError(404, "NOT_FOUND", message);
}

export type InternalInstance = {
  id: string;
  tenantId: string;
  instanceName: string;
  sandbox: boolean;
  status: string;
};

export type InternalApiContext = {
  tenantId: string;
  instance: InternalInstance;
};

/**
 * Resolve autenticação + escopo de tenant da API interna (docs/arquitetura.md §6.1):
 * - `Authorization: Bearer <segredo>` comparado em tempo constante contra o hash salvo em
 *   `PlatformSettings.internalApiSecretHash` (`verifyInternalApiSecret`, Fase 1).
 * - `X-InnoChat-Instance: <webhookToken>` resolve SEMPRE o tenant pela instância — o `tenantId`
 *   nunca é aceito no corpo da requisição.
 *
 * Qualquer falha nesta função (segredo ausente/errado, header de instância ausente/inválido,
 * instância removida) é **401 UNAUTHORIZED** — nunca 403, para não confirmar nada sobre a
 * existência de recursos a quem não está autenticado.
 */
export async function resolveInternalRequest(req: Request): Promise<InternalApiContext> {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!secret) {
    throw new InternalApiError(401, "UNAUTHORIZED", "Cabeçalho Authorization ausente ou inválido.");
  }

  const settings = await getPrisma().platformSettings.findUnique({
    where: { id: 1 },
    select: { internalApiSecretHash: true },
  });
  if (!settings?.internalApiSecretHash || !verifyInternalApiSecret(secret, settings.internalApiSecretHash)) {
    throw new InternalApiError(401, "UNAUTHORIZED", "Segredo inválido.");
  }

  const instanceToken = req.headers.get("x-innochat-instance") ?? "";
  if (!instanceToken) {
    throw new InternalApiError(401, "UNAUTHORIZED", "Cabeçalho X-InnoChat-Instance ausente.");
  }

  const instance = await getPrisma().whatsappInstance.findUnique({ where: { webhookToken: instanceToken } });
  if (!instance || instance.deletedAt) {
    throw new InternalApiError(401, "UNAUTHORIZED", "Instância não encontrada para este token.");
  }

  return {
    tenantId: instance.tenantId,
    instance: {
      id: instance.id,
      tenantId: instance.tenantId,
      instanceName: instance.instanceName,
      sandbox: instance.sandbox,
      status: instance.status,
    },
  };
}
