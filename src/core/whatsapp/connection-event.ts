/**
 * Normalização PURA do webhook `connection.update`/`CONNECTION_UPDATE` da Evolution API v2
 * (docs/arquitetura.md §4, §6.9) — mesmo espírito de `src/core/bot/evolution-normalize.ts`:
 * sem I/O, nunca lança, payload irreconhecível vira `null` (quem chama devolve `200` mesmo
 * assim — nunca 5xx para um evento que a Evolution reentregaria em loop).
 *
 * ⚠️ HONESTIDADE SOBRE O QUE FOI VERIFICADO: formato baseado na documentação pública da
 * Evolution API v2 e no adaptador validado ao vivo do InnoAtendente (2026-09-04) — **não
 * capturado de um servidor real do InnoChat** (Fase 0 desta arquitetura ainda não rodou, ver
 * `fixtures/evolution/README.md`). Quando um payload real chegar e algum campo tiver nome
 * diferente, só este arquivo (e os testes que o acompanham) precisam mudar.
 *
 * Formato esperado:
 *   { event: "connection.update" | "CONNECTION_UPDATE", instance: "<instanceName>",
 *     data: { state: "open" | "connecting" | "close", wuid?: string } }
 *
 * `instance` no corpo é IGNORADO de propósito: quem consome isto (`POST /connection-events`,
 * `src/modules/bot-api/connection-events.ts`) já resolveu a instância pelo `webhookToken` do
 * path (`X-InnoChat-Instance`, `resolveInternalRequest`) ANTES de chamar isto — o `tenantId`/
 * instância nunca vêm do corpo (docs/arquitetura.md §6.1). Exigir o campo aqui só duplicaria
 * uma verificação que já existe em outro lugar, e um payload real da Evolution sem esse campo
 * (ou com um nome de instância "estranho", ex. por trás de `byEvents:true`) não pode virar um
 * falso negativo.
 */

export type EvolutionConnectionState = "CONNECTED" | "QRCODE" | "DISCONNECTED";

export type NormalizedConnectionEvent = {
  state: EvolutionConnectionState;
  /** JID do dono da instância (`data.wuid`), só presente quando `state === "CONNECTED"`. */
  ownerJid: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Mapeamento dos valores de `data.state` (biblioteca Baileys, usada por baixo da Evolution) —
 * `open` = conectado, `connecting` = aguardando o QR ser escaneado, `close`/`closed` =
 * desconectado. Qualquer outro valor é desconhecido → `null` (evento ignorado, sem alterar
 * status local).
 */
export function mapEvolutionState(state: string | undefined): EvolutionConnectionState | null {
  switch (state) {
    case "open":
      return "CONNECTED";
    case "connecting":
      return "QRCODE";
    case "close":
    case "closed":
      return "DISCONNECTED";
    default:
      return null;
  }
}

/**
 * Só regride para `DISCONNECTED` quando o status LOCAL já era `CONNECTED` (queda real,
 * docs/arquitetura.md §4 passo 5, "Queda inesperada"). Uma instância que nunca conectou fica em
 * `close`/`closed` na Evolution o tempo todo enquanto espera o QR ser escaneado — isso NÃO é
 * "queda", é o estado normal de espera, e regredir para `DISCONNECTED` confundiria a tela
 * (mostraria "desconectado" para um número que nunca esteve conectado). Compartilhada por
 * `src/modules/whatsapp/service.ts` (polling do dashboard) e
 * `src/modules/bot-api/connection-events.ts` (webhook) — mesma regra, um lugar só.
 */
export function resolveNextConnectionStatus(
  currentStatus: EvolutionConnectionState,
  mapped: EvolutionConnectionState,
): EvolutionConnectionState {
  if (mapped !== "DISCONNECTED") return mapped;
  return currentStatus === "CONNECTED" ? "DISCONNECTED" : currentStatus;
}

export function parseConnectionEvent(rawBody: unknown): NormalizedConnectionEvent | null {
  if (!isRecord(rawBody)) return null;

  const eventName = typeof rawBody.event === "string" ? rawBody.event.toUpperCase().replace(/\./g, "_") : undefined;
  if (eventName !== "CONNECTION_UPDATE") return null;

  const data = rawBody.data;
  const rawState = isRecord(data) && typeof data.state === "string" ? data.state.toLowerCase() : undefined;
  const state = mapEvolutionState(rawState);
  if (!state) return null;

  const wuid = isRecord(data) && typeof data.wuid === "string" ? data.wuid : null;

  return {
    state,
    ownerJid: state === "CONNECTED" ? wuid : null,
  };
}
