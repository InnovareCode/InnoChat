import { getPrisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

/**
 * `POST /api/internal/v1/maintenance/tick` (docs/contratos.md — "Segurança"). Aplica a
 * retenção/anonimização de LGPD declarada em `docs/arquitetura.md` §11/§12, que estava só
 * documentada (revisão de segurança 2026-09-28, achado MÉDIA — nenhum job fazia isso).
 * Chamado periodicamente pelo `innochat-cron` (mesmo cron externo do `billing/tick`, fora deste
 * repo) — não criamos workflow novo no n8n aqui, só o endpoint que ele vai chamar.
 *
 * Duas ações, sempre nesta ordem:
 * 1. **Purga `InboundEvent`** com `createdAt` > 30 dias (§11: "purga após 30 dias"). Sem
 *    limite/paginação necessária: é um único `DELETE ... WHERE createdAt < ?`, o Postgres lida
 *    com qualquer volume numa chamada — não é uma listagem paginada para o client.
 * 2. **Anonimiza `Contact`** de tenants com `Subscription.status = CANCELED` há mais de 90 dias
 *    (§11: "dados guardados 90 dias e depois anonimizados"). Zera `name`/`pushName`/`phoneE164`/
 *    `lid` e substitui `waJid` (não-nulo, único por tenant) por um marcador `anon:<contactId>`
 *    — mantém a linha (e a integridade referencial com `Appointment` histórico), só remove o
 *    dado pessoal. Processado em lotes (`ANONYMIZE_BATCH_LIMIT` por chamada) — a próxima
 *    execução horária continua de onde parou; nunca uma varredura ilimitada numa chamada só.
 *
 * Idempotente por desenho: rodar 2x seguidas não tem efeito adicional (`InboundEvent` antigo já
 * foi apagado; `Contact` já anonimizado é reconhecido pelo prefixo `anon:` em `waJid` e pulado).
 */

const INBOUND_EVENT_RETENTION_DAYS = 30;
const CANCELED_ANONYMIZATION_DAYS = 90;
const ANONYMIZE_BATCH_LIMIT = 500;
const ANON_WAJID_PREFIX = "anon:";

export type MaintenanceTickSummary = {
  inboundEventsPurged: number;
  contactsAnonymized: number;
};

export async function runMaintenanceTick(now: Date = new Date()): Promise<MaintenanceTickSummary> {
  const prisma = getPrisma();

  const inboundEventCutoff = new Date(now.getTime() - INBOUND_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const purged = await prisma.inboundEvent.deleteMany({ where: { createdAt: { lt: inboundEventCutoff } } });

  const cancellationCutoff = new Date(now.getTime() - CANCELED_ANONYMIZATION_DAYS * 24 * 60 * 60 * 1000);
  const contactsToAnonymize = await prisma.contact.findMany({
    where: {
      tenant: { subscription: { status: "CANCELED", canceledAt: { lt: cancellationCutoff } } },
      NOT: { waJid: { startsWith: ANON_WAJID_PREFIX } },
    },
    select: { id: true },
    take: ANONYMIZE_BATCH_LIMIT,
  });

  let contactsAnonymized = 0;
  for (const contact of contactsToAnonymize) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        waJid: `${ANON_WAJID_PREFIX}${contact.id}`,
        phoneE164: null,
        lid: null,
        name: null,
        pushName: null,
      },
    });
    contactsAnonymized += 1;
  }

  const summary: MaintenanceTickSummary = {
    inboundEventsPurged: purged.count,
    contactsAnonymized,
  };
  logger.info("maintenance.tick.completed", { ...summary });
  return summary;
}
