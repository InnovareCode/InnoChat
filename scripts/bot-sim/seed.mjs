// Semeia os tenants do simulador do bot no banco apontado por DATABASE_URL (use o banco DEDICADO innochat_botsim).
// Uso: node scripts/bot-sim/withdb.mjs node scripts/bot-sim/seed.mjs
// Idempotente: apaga os tenants `botsim-*` e recria. Escreve scripts/bot-sim/.seed.json (não versionado).
import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
export const INTERNAL_SECRET = "botsim-internal-secret-0123456789";
const sha = (s) => createHash("sha256").update(s).digest("hex");

const url = process.env.DATABASE_URL ?? "";
if (!/innochat_(test|botsim)/.test(url) && process.env.BOTSIM_ALLOW_ANY_DB !== "1") {
  console.error("Recusando: DATABASE_URL não aponta para innochat_test. (BOTSIM_ALLOW_ANY_DB=1 para forçar)");
  process.exit(1);
}

await prisma.tenant.deleteMany({ where: { slug: { startsWith: "botsim-" } } });
await prisma.plan.deleteMany({ where: { code: "botsim-plan" } });
const plan = await prisma.plan.create({ data: { code: "botsim-plan", name: "Plano botsim", priceCents: 0, maxWhatsappNumbers: 5, maxProfessionals: null, active: false, sortOrder: 999 } });
await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, internalApiSecretHash: sha(INTERNAL_SECRET) }, update: { internalApiSecretHash: sha(INTERNAL_SECRET) } });

async function mkTenant(key, data) {
  const tenant = await prisma.tenant.create({ data: { slug: `botsim-${key}`, ...data } });
  await prisma.subscription.create({ data: { tenantId: tenant.id, planId: plan.id, status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 90 * 86_400_000) } });
  const token = `botsim-token-${key}-${randomUUID().slice(0, 8)}`;
  const instance = await prisma.whatsappInstance.create({ data: { tenantId: tenant.id, instanceName: `botsim-${key}`, label: "Principal", webhookToken: token, status: "CONNECTED" } });
  return { tenant, instance, token };
}
const svc = (tenantId, name, durationMin, priceCents, sortOrder, extra = {}) => prisma.service.create({ data: { tenantId, name, durationMin, priceCents, sortOrder, ...extra } });
const pro = (tenantId, name, sortOrder, days, from, to) =>
  prisma.professional.create({ data: { tenantId, name, sortOrder, workingHours: { create: days.map((weekday) => ({ weekday, startTime: from, endTime: to })) } } });
const link = (professionalId, serviceIds) => prisma.professionalService.createMany({ data: serviceIds.map((serviceId) => ({ professionalId, serviceId })) });

const out = {};

// --- Studio Bela: fuso de São Paulo, muitos serviços, 3 profissionais ---
{
  const { tenant, token } = await mkTenant("bela", { name: "Studio Bela", timezone: "America/Sao_Paulo", slotGranularityMin: 30, minLeadTimeMin: 60, maxHorizonDays: 30, cancelMinLeadMin: 120, sessionTimeoutMin: 30, reminderEnabled: false });
  const T = tenant.id;
  const names = [["Corte feminino", 60, 8000], ["Escova", 45, 5000], ["Barba", 30, 3500], ["Coloração", 120, 18000], ["Hidratação", 60, 7000], ["Manicure", 60, 4000], ["Pedicure", 60, 4500], ["Sobrancelha", 30, null], ["Massagem", 60, 12000], ["Depilação", 30, 6000], ["Maquiagem", 60, 15000]];
  const S = {};
  let i = 0;
  for (const [n, d, p] of names) S[n] = await svc(T, n, d, p, i++);
  S["Limpeza de pele"] = await svc(T, "Limpeza de pele", 60, 9000, i++); // sem nenhum profissional
  S["Sem expediente"] = await svc(T, "Sem expediente", 60, 1000, i++); // só a Carla (sem horário de trabalho)
  S["Legado"] = await svc(T, "Legado inativo", 60, 100, i++, { active: false });
  const semBarba = Object.values(S).filter((s) => !["Barba", "Limpeza de pele", "Sem expediente", "Legado inativo"].includes(s.name)).map((s) => s.id);
  const ana = await pro(T, "Ana", 0, [1, 2, 3, 4, 5, 6], "09:00", "18:00");
  const bruno = await pro(T, "Bruno", 1, [2, 3, 4, 5], "10:00", "16:00");
  const carla = await pro(T, "Carla", 2, [], "09:00", "18:00"); // sem expediente
  await pro(T, "Dani (inativa)", 3, [1, 2, 3], "09:00", "18:00").then((d) => prisma.professional.update({ where: { id: d.id }, data: { active: false } }));
  await link(ana.id, semBarba);
  await link(bruno.id, [S["Corte feminino"].id, S["Barba"].id, S["Escova"].id]);
  await link(carla.id, [S["Corte feminino"].id, S["Escova"].id, S["Sem expediente"].id]);
  out.bela = { tenantId: T, token, services: Object.fromEntries(Object.entries(S).map(([k, v]) => [k, v.id])), pros: { ana: ana.id, bruno: bruno.id, carla: carla.id } };
}

// --- Fusos extremos (virada de dia): Tóquio (+9), Honolulu (-10) e Kiritimati (+14: quase sempre 'amanhã' em relação ao UTC) ---
for (const [key, tz] of [["tokyo", "Asia/Tokyo"], ["honolulu", "Pacific/Honolulu"], ["kiribati", "Pacific/Kiritimati"]]) {
  const { tenant, token } = await mkTenant(key, { name: `Clínica ${key}`, timezone: tz, slotGranularityMin: 60, minLeadTimeMin: 0, maxHorizonDays: 14, cancelMinLeadMin: 120, reminderEnabled: false });
  const s = await svc(tenant.id, "Consulta", 60, 10000, 0);
  const p = await pro(tenant.id, "Dr. Noite", 0, [0, 1, 2, 3, 4, 5, 6], "08:00", "23:59");
  await link(p.id, [s.id]);
  out[key] = { tenantId: tenant.id, token, services: { Consulta: s.id }, pros: { p: p.id } };
}

// --- Empresa sem serviço nenhum ---
{
  const { tenant, token } = await mkTenant("vazio", { name: "Empresa Vazia", timezone: "America/Sao_Paulo", reminderEnabled: false });
  out.vazio = { tenantId: tenant.id, token };
}

// --- Empresa com 1 só profissional, askProfessional=false, 2 profissionais em outro serviço ---
{
  const { tenant, token } = await mkTenant("solo", { name: "Solo Barbearia", timezone: "America/Manaus", slotGranularityMin: 15, minLeadTimeMin: 0, maxHorizonDays: 60, askProfessional: false, reminderEnabled: false });
  const s = await svc(tenant.id, "Corte", 30, 4000, 0);
  const p1 = await pro(tenant.id, "Zé", 0, [1, 2, 3, 4, 5], "09:00", "12:00");
  const p2 = await pro(tenant.id, "Léo", 1, [1, 2, 3, 4, 5], "14:00", "17:00");
  await link(p1.id, [s.id]); await link(p2.id, [s.id]);
  out.solo = { tenantId: tenant.id, token, services: { Corte: s.id }, pros: { ze: p1.id, leo: p2.id } };
}

writeFileSync(join(here, ".seed.json"), JSON.stringify({ secret: INTERNAL_SECRET, tenants: out }, null, 2));
console.log("seed ok:", Object.keys(out).join(", "));
await prisma.$disconnect();
