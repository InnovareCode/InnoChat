// Seed LOCAL da central de notificações (para gerar prints/testar a UI). Não roda em produção.
//
//   npm run db:seed:notifications -- [tenantSlug] [--billing] [--clean]
//
// - tenantSlug: padrão "studio-demo" (criado por `npm run db:seed`). A empresa precisa existir.
// - Cria (idempotente: apaga o que ele mesmo criou antes) clientes fictícios, agendamentos e
//   AppointmentEvent de todos os tipos, com horários relativos a "agora":
//     * 2 agendamentos começando em ~25 e ~50 min (viram APPOINTMENT_UPCOMING e aparecem em
//       getUpcomingAppointmentsAction);
//     * eventos CREATED (WhatsApp e painel), RESCHEDULED, CANCELED, COMPLETED e NO_SHOW espalhados
//       entre 1 min e 26 h atrás (dá para ver "agora", "há 10 min", "ontem" e o agrupamento);
//     * 1 instância de WhatsApp "caída" há 5 min (WHATSAPP_DISCONNECTED).
// - --billing: também coloca a assinatura em TRIALING com fim em 10 h (TRIAL_ENDING) e cria uma
//   fatura paga (PAYMENT_CONFIRMED). Altera a assinatura da empresa — só use em banco local.
// - --clean: só remove o que o seed criou.
//
// Telefones são FICTÍCIOS (+5500...). Nada aqui usa dado real.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_JID_PREFIX = "seed-ntf-";
const SEED_INSTANCE_PREFIX = "seed-ntf-";
const SEED_MP_ID = "seed-ntf";

const MIN = 60_000;
const HOUR = 60 * MIN;

async function clean(tenantId: string) {
  // Cascata: apagar o Contact apaga Appointment e AppointmentEvent.
  await prisma.contact.deleteMany({ where: { tenantId, waJid: { startsWith: SEED_JID_PREFIX } } });
  await prisma.whatsappInstance.deleteMany({ where: { tenantId, instanceName: { startsWith: SEED_INSTANCE_PREFIX } } });
  await prisma.invoice.deleteMany({ where: { mpPaymentId: SEED_MP_ID, subscription: { tenantId } } });
}

/** Trava de ambiente (revisão do Órion, 2026-09-30): com `--billing` este script altera assinatura e
 * cria fatura paga — nunca pode rodar contra o banco de produção. */
function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // URL ausente/ilegível: cai na recusa abaixo.
  }
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  if (process.env.NODE_ENV === "production" || !isLocal) {
    throw new Error("seed-notifications só roda contra banco local (localhost). Abortado.");
  }
}

async function main() {
  assertLocalDatabase();
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const slug = args.find((a) => !a.startsWith("--")) ?? "studio-demo";

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw new Error(`Empresa "${slug}" não existe. Rode "npm run db:seed" ou passe o slug de uma empresa local.`);

  await clean(tenant.id);
  if (flags.has("--clean")) {
    console.log(`Seed de notificações removido de "${slug}".`);
    return;
  }

  const services = await prisma.service.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { sortOrder: "asc" }, take: 3 });
  if (services.length === 0) {
    services.push(await prisma.service.create({ data: { tenantId: tenant.id, name: "Corte", durationMin: 30 } }));
  }
  const professionals = await prisma.professional.findMany({ where: { tenantId: tenant.id, active: true }, orderBy: { sortOrder: "asc" }, take: 3 });
  for (const name of ["Ana", "Bruno"]) {
    if (professionals.length < 2) professionals.push(await prisma.professional.create({ data: { tenantId: tenant.id, name } }));
  }

  const people = ["Maria Souza", "João Lima", "Carla Dias", "Pedro Alves", "Fernanda Rocha", "Rafael Costa"];
  const contacts: Awaited<ReturnType<typeof prisma.contact.create>>[] = [];
  for (const [i, name] of people.entries()) {
    contacts.push(
      await prisma.contact.create({
        data: { tenantId: tenant.id, waJid: `${SEED_JID_PREFIX}${i}@s.whatsapp.net`, phoneE164: `+55000000000${i}`, name },
      }),
    );
  }

  const now = Date.now();
  let n = 0;
  async function appointment(opts: { contact: number; inMin?: number; inDays?: number; source: "WHATSAPP" | "PANEL"; status?: "SCHEDULED" | "CANCELED" | "COMPLETED" | "NO_SHOW" }) {
    const service = services[n % services.length];
    const professional = professionals[n % professionals.length];
    n += 1;
    const startsAt = new Date(now + (opts.inMin ?? 0) * MIN + (opts.inDays ?? 0) * 24 * HOUR);
    const endsAt = new Date(startsAt.getTime() + service.durationMin * MIN);
    try {
      return await prisma.appointment.create({
        data: {
          tenantId: tenant!.id,
          contactId: contacts[opts.contact].id,
          serviceId: service.id,
          professionalId: professional.id,
          startsAt,
          endsAt,
          blockEndsAt: new Date(endsAt.getTime() + service.bufferAfterMin * MIN),
          source: opts.source,
          status: opts.status ?? "SCHEDULED",
        },
      });
    } catch (error) {
      console.warn(`Agendamento pulado (conflito de horário com dados existentes): ${error instanceof Error ? error.message.split("\n")[0] : error}`);
      return null;
    }
  }
  async function event(appt: { id: string } | null, action: "CREATED" | "CANCELED" | "RESCHEDULED" | "COMPLETED" | "NO_SHOW", authorType: "CONTACT" | "USER" | "SYSTEM", agoMin: number) {
    if (!appt) return;
    await prisma.appointmentEvent.create({ data: { appointmentId: appt.id, action, authorType, createdAt: new Date(now - agoMin * MIN) } });
  }

  const upcoming1 = await appointment({ contact: 0, inMin: 25, source: "WHATSAPP" });
  await event(upcoming1, "CREATED", "CONTACT", 26 * 60);
  const upcoming2 = await appointment({ contact: 1, inMin: 50, source: "PANEL" });
  await event(upcoming2, "CREATED", "USER", 20 * 60);

  const a3 = await appointment({ contact: 2, inDays: 1, source: "WHATSAPP" });
  await event(a3, "CREATED", "CONTACT", 1);
  const a4 = await appointment({ contact: 3, inDays: 2, source: "PANEL" });
  await event(a4, "CREATED", "USER", 8);
  const a5 = await appointment({ contact: 4, inDays: 1, inMin: 120, source: "WHATSAPP" });
  await event(a5, "CREATED", "CONTACT", 300);
  await event(a5, "RESCHEDULED", "CONTACT", 14);
  const a6 = await appointment({ contact: 5, inDays: 3, source: "WHATSAPP", status: "CANCELED" });
  await event(a6, "CREATED", "CONTACT", 26 * 60 + 30);
  await event(a6, "CANCELED", "CONTACT", 31);
  const a7 = await appointment({ contact: 0, inMin: -180, source: "PANEL", status: "COMPLETED" });
  await event(a7, "CREATED", "USER", 26 * 60 + 5);
  await event(a7, "COMPLETED", "USER", 90);
  const a8 = await appointment({ contact: 1, inMin: -300, source: "WHATSAPP", status: "NO_SHOW" });
  await event(a8, "CREATED", "CONTACT", 26 * 60 + 10);
  await event(a8, "NO_SHOW", "SYSTEM", 200);

  await prisma.whatsappInstance.create({
    data: {
      tenantId: tenant.id,
      instanceName: `${SEED_INSTANCE_PREFIX}${Date.now()}`,
      label: "Recepção",
      status: "DISCONNECTED",
      webhookToken: `${SEED_INSTANCE_PREFIX}${Date.now()}-token`,
      lastConnectedAt: new Date(now - 6 * HOUR),
      disconnectedAt: new Date(now - 5 * MIN),
    },
  });

  if (flags.has("--billing")) {
    const sub = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
    if (!sub) {
      console.warn("Empresa sem assinatura: --billing ignorado.");
    } else {
      const trialEndsAt = new Date(now + 10 * HOUR);
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "TRIALING", trialEndsAt, currentPeriodEnd: trialEndsAt } });
      await prisma.invoice.create({
        data: {
          subscriptionId: sub.id,
          amountCents: 4990,
          periodStart: new Date(now - 30 * 24 * HOUR),
          periodEnd: trialEndsAt,
          dueAt: new Date(now - 2 * HOUR),
          status: "PAID",
          paidAt: new Date(now - 2 * HOUR),
          mpPaymentId: SEED_MP_ID,
        },
      });
    }
  }

  console.log(`Seed de notificações criado em "${slug}". Abra o painel logado como um membro dessa empresa.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
