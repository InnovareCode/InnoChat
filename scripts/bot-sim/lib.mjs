// Infra compartilhada dos cenários: engine + mundo + seed + helpers de conversa/DB.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Engine } from "./engine.mjs";
import { World, Chat } from "./chat.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const seed = JSON.parse(readFileSync(join(here, ".seed.json"), "utf8"));
export const PANEL = process.env.BOTSIM_PANEL || "http://localhost:3900";
export const API = `${PANEL}/api/internal/v1`;

export function makeWorld() {
  const engine = new Engine({ workflowPath: process.env.BOTSIM_WORKFLOW || join(here, "../../n8n/innochat-bot.json"), painelUrl: API, secret: seed.secret });
  return new World(engine);
}

let prismaP;
/** Prisma para arrumar estado (envelhecer sessão, bloqueios, pausar bot). Lazy: só importa se usado. */
export async function db() {
  if (!prismaP) {
    const { PrismaClient } = await import("@prisma/client");
    prismaP = new PrismaClient();
  }
  return prismaP;
}
export async function closeDb() { if (prismaP) await prismaP.$disconnect(); }

export const RUN = String(Date.now()).slice(-7);
let phoneSeq = 0;
/** Telefone único por execução/cenário (o banco persiste entre execuções). */
export const newPhone = () => `55119${RUN}${String(++phoneSeq).padStart(2, "0")}`.slice(0, 15);

/** Chamada crua à API interna (para montar estado: ocupar horário etc.). */
export async function api(tenantKey, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${seed.secret}`, "x-innochat-instance": seed.tenants[tenantKey].token, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  return { status: res.status, body: txt ? JSON.parse(txt) : null };
}

/** Extrai as opções "N. rótulo" da última mensagem do bot. */
export function parseOptions(text) {
  return [...String(text || "").matchAll(/^(\d+)\. (.+)$/gm)].map((m) => ({ n: Number(m[1]), label: m[2] })).filter((o) => o.n > 0);
}

export class Convo extends Chat {
  constructor(world, tenantKey, phone, opts) {
    super(world, seed.tenants[tenantKey].token, phone, opts);
    this.tenantKey = tenantKey;
    this.last = "";
  }
  async say(text, o) {
    const r = await super.say(text, o);
    if (r.msgs.length) this.last = r.msgs[r.msgs.length - 1];
    return r;
  }
  /** Escolhe pelo rótulo (regex) na última mensagem, respondendo com o número. */
  async pick(re) {
    const opt = parseOptions(this.last).find((o) => re.test(o.label));
    if (!opt) throw new Error(`opção ${re} não encontrada em:\n${this.last}`);
    return this.say(String(opt.n));
  }
  async contactId() {
    const p = await db();
    const t = seed.tenants[this.tenantKey];
    const c = await p.contact.findFirst({ where: { tenantId: t.tenantId, waJid: this.jid } });
    return c?.id;
  }
  async sessionRow() {
    const p = await db();
    return p.chatSession.findFirst({ where: { contactId: await this.contactId() } });
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
