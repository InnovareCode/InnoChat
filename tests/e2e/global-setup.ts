import { prisma, hashPassword, ensureBotPlan } from "./fixtures/db";
import { SEED_TENANT_SLUG, TENANT_B_OWNER_PASSWORD, STAFF_PASSWORD, generateRunFixtures, saveRunFixtures } from "./fixtures/test-data";

/**
 * Roda UMA vez antes da suíte inteira (`playwright.config.ts`), no processo PRINCIPAL do
 * Playwright. Cria as duas fixtures que a UI não expõe: uma segunda empresa completa (isolamento
 * entre tenants) e um membro STAFF na empresa de seed (restrição "só OWNER troca o tema").
 *
 * Os identificadores gerados aqui (slugs/e-mails com timestamp) são salvos em disco — os specs
 * rodam em processos de WORKER separados, que reavaliariam `Date.now()` com outro valor se
 * tentassem gerar o prefixo de novo (ver comentário em `fixtures/test-data.ts`).
 */
export default async function globalSetup() {
  const generated = generateRunFixtures();
  const plan = await ensureBotPlan();

  // Empresa B — isolada, com seu próprio OWNER.
  const tenantB = await prisma.tenant.create({
    data: {
      slug: generated.tenantBSlug,
      name: "Empresa B (E2E)",
      timezone: "America/Sao_Paulo",
    },
  });
  await prisma.subscription.create({
    data: { tenantId: tenantB.id, planId: plan.id, status: "ACTIVE", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) },
  });
  const ownerB = await prisma.user.create({
    data: {
      email: generated.tenantBOwnerEmail,
      passwordHash: await hashPassword(TENANT_B_OWNER_PASSWORD),
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "e2e",
    },
  });
  await prisma.membership.create({ data: { userId: ownerB.id, tenantId: tenantB.id, role: "OWNER" } });

  // Cria um profissional em B com um id previsível de guardar — usado no teste de isolamento
  // (tentar acessar `/studio-demo/profissionais/{id-do-profissional-de-B}`).
  const professionalB = await prisma.professional.create({
    data: { tenantId: tenantB.id, name: "Profissional da Empresa B", sortOrder: 0 },
  });

  // Membro STAFF (não-OWNER) da empresa de SEED.
  const tenantSeed = await prisma.tenant.findUniqueOrThrow({ where: { slug: SEED_TENANT_SLUG } });

  // O tenant de seed já está no limite do plano (3 profissionais — 2 do seed + "Profissional QA",
  // leftover de sessão manual anterior, com 1 agendamento pendurado, então não é seguro apagar).
  // Sobe o override SÓ para esta suíte poder criar um profissional extra sem tropeçar no limite
  // — não é o que estamos testando aqui, e `global-teardown.ts` devolve para `null`.
  await prisma.tenant.update({ where: { id: tenantSeed.id }, data: { maxProfessionalsOverride: 10 } });
  const staffUser = await prisma.user.create({
    data: {
      email: generated.staffEmail,
      passwordHash: await hashPassword(STAFF_PASSWORD),
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
      termsVersion: "e2e",
    },
  });
  await prisma.membership.create({ data: { userId: staffUser.id, tenantId: tenantSeed.id, role: "STAFF" } });

  saveRunFixtures({
    ...generated,
    tenantBId: tenantB.id,
    professionalBId: professionalB.id,
    tenantSeedId: tenantSeed.id,
  });

  await prisma.$disconnect();
}
