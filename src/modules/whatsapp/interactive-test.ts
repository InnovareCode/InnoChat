import { z } from "zod";
import { DomainError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getPrisma } from "@/lib/db/prisma";
import { parseBrazilianPhoneToE164 } from "@/core/whatsapp/phone";
import {
  EvolutionApiError,
  getEvolutionClient,
  type EvolutionClient,
  type EvolutionInteractiveSendResult,
} from "./evolution-client";

/**
 * Envio de TESTE de mensagem interativa (botões / lista / enquete) — só para o admin da plataforma
 * provar, no celular dele, o que o WhatsApp renderiza numa instância Baileys
 * (docs/whatsapp-botoes-listas.md). Não guarda o número testado (nem em banco, nem em log).
 *
 * Atenção: o eco `fromMe` da mensagem enviada chega ao `claim` como "mídia" (não bate com
 * `recentOutbound`). Se o número testado for um cliente cadastrado da empresa, o bot dele pausa
 * ("humano assumiu"). Teste com um número que não seja cliente.
 */

export const INTERACTIVE_KINDS = ["buttons", "list", "poll"] as const;
export type InteractiveKind = (typeof INTERACTIVE_KINDS)[number];

export const interactiveTestInputSchema = z
  .object({
    instanceId: z.string().trim().min(1).max(64).optional(),
    tenantSlug: z.string().trim().min(1).max(64).optional(),
    to: z.string().trim().min(8).max(30),
    kind: z.enum(INTERACTIVE_KINDS),
  })
  .refine((v) => Boolean(v.instanceId) !== Boolean(v.tenantSlug), {
    message: "Informe instanceId OU tenantSlug (apenas um).",
    path: ["instanceId"],
  });

export type InteractiveTestInput = z.infer<typeof interactiveTestInputSchema>;

export type InteractiveTestResult = {
  kind: InteractiveKind;
  instanceLabel: string;
  /** A Evolution aceitou o envio (2xx). NÃO prova que o WhatsApp renderizou — isso quem confirma é o celular. */
  accepted: boolean;
  /** Status HTTP da Evolution (`null` = falha de rede/timeout antes de haver resposta). */
  status: number | null;
  /** Corpo da resposta (ou do erro) da Evolution, JSON formatado e truncado. Sem segredo (a apikey só vai no header). */
  responseBody: string;
  /** Descrição do que foi enviado (o número aparece mascarado). */
  sentPayloadNote: string;
};

export type TestableInstance = { id: string; label: string; tenantName: string; tenantSlug: string };

const MAX_BODY_CHARS = 2_000;
const QUESTION = "Qual serviço você quer?";
const OPTIONS = ["Corte", "Escova", "Coloração"] as const;

function truncate(text: string): string {
  return text.length > MAX_BODY_CHARS ? `${text.slice(0, MAX_BODY_CHARS)}… (truncado)` : text;
}

function formatBody(body: unknown): string {
  if (body == null) return "(corpo vazio)";
  if (typeof body === "string") return truncate(body);
  return truncate(JSON.stringify(body, null, 2));
}

function formatErrorBody(raw: string | undefined): string {
  if (!raw) return "(corpo vazio)";
  try {
    return truncate(JSON.stringify(JSON.parse(raw), null, 2));
  } catch {
    return truncate(raw);
  }
}

/** Dígitos para a Evolution (`number`), sem "+". */
function toEvolutionNumber(input: string): string {
  const e164 = parseBrazilianPhoneToE164(input);
  if (!e164) throw new DomainError("INVALID_PHONE", "Telefone brasileiro inválido. Use DDD + número, ex.: (11) 91234-5678.");
  return e164.replace(/\D/g, "");
}

/** Instâncias elegíveis para o teste: CONNECTED, não sandbox, não removidas. */
export async function listTestableInstances(): Promise<TestableInstance[]> {
  const rows = await getPrisma().whatsappInstance.findMany({
    where: { status: "CONNECTED", sandbox: false, deletedAt: null },
    orderBy: [{ tenantId: "asc" }, { createdAt: "asc" }],
    take: 100,
    select: { id: true, label: true, tenant: { select: { name: true, slug: true } } },
  });
  return rows.map((r) => ({ id: r.id, label: r.label, tenantName: r.tenant.name, tenantSlug: r.tenant.slug }));
}

async function resolveInstance(input: InteractiveTestInput): Promise<{ instanceName: string; label: string }> {
  const where = input.instanceId ? { id: input.instanceId } : { tenant: { slug: input.tenantSlug } };
  const instance = await getPrisma().whatsappInstance.findFirst({
    // Por tenantSlug pega a primeira instância ELEGÍVEL (não a primeira qualquer).
    where: input.instanceId ? { ...where, deletedAt: null } : { ...where, deletedAt: null, status: "CONNECTED", sandbox: false },
    orderBy: { createdAt: "asc" },
    select: { instanceName: true, label: true, status: true, sandbox: true },
  });
  if (!instance) throw new DomainError("INSTANCE_NOT_FOUND", "Número de WhatsApp conectado não encontrado.");
  if (instance.sandbox) throw new DomainError("INSTANCE_SANDBOX", "Instância de teste (sandbox) não envia pela Evolution real.");
  if (instance.status !== "CONNECTED") throw new DomainError("INSTANCE_NOT_CONNECTED", "O número precisa estar conectado para o teste.");
  return { instanceName: instance.instanceName, label: instance.label };
}

/** Monta o envio de exemplo; `id`/`rowId` são os números da opção — o mesmo que o cliente digitaria. */
function sendSample(
  client: EvolutionClient,
  instanceName: string,
  number: string,
  kind: InteractiveKind,
): Promise<EvolutionInteractiveSendResult> {
  switch (kind) {
    case "buttons":
      return client.sendButtons(instanceName, number, {
        title: QUESTION,
        footer: "Teste do InnoChat",
        buttons: OPTIONS.map((label, i) => ({ type: "reply" as const, displayText: label, id: String(i + 1) })),
      });
    case "list":
      return client.sendList(instanceName, number, {
        title: QUESTION,
        description: "Toque no botão para escolher.",
        footerText: "Teste do InnoChat",
        buttonText: "Ver opções",
        sections: [{ title: "Serviços", rows: OPTIONS.map((label, i) => ({ title: label, rowId: String(i + 1) })) }],
      });
    case "poll":
      return client.sendPoll(instanceName, number, {
        name: QUESTION,
        selectableCount: 1,
        values: OPTIONS.map((label, i) => `${i + 1} - ${label}`),
      });
  }
}

export async function sendInteractiveTest(rawInput: unknown, deps: { client?: EvolutionClient } = {}): Promise<InteractiveTestResult> {
  const input = interactiveTestInputSchema.parse(rawInput);
  const number = toEvolutionNumber(input.to);
  const instance = await resolveInstance(input);
  const client = deps.client ?? (await getEvolutionClient());

  const base = {
    kind: input.kind,
    instanceLabel: instance.label,
    sentPayloadNote: `Exemplo "${QUESTION}" com ${OPTIONS.join(" · ")}, enviado para ***${number.slice(-4)}.`,
  };
  try {
    const result = await sendSample(client, instance.instanceName, number, input.kind);
    logger.info("whatsapp.interactive_test_sent", { kind: input.kind, status: result.status });
    return { ...base, accepted: true, status: result.status, responseBody: formatBody(result.body) };
  } catch (error) {
    if (!(error instanceof EvolutionApiError)) throw error;
    logger.warn("whatsapp.interactive_test_failed", { kind: input.kind, status: error.status ?? null });
    return {
      ...base,
      accepted: false,
      status: error.status ?? null,
      responseBody: error.status ? formatErrorBody(error.responseBody) : error.message,
    };
  }
}
