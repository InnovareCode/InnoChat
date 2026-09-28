import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { getPrisma } from "@/lib/db/prisma";
import { effectiveStatus } from "@/core/billing";
import { AssinaturaClient, type BillingSnapshot } from "./assinatura-client";

export default async function AssinaturaPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await getPrisma().tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, timezone: true } });
  if (!tenant) {
    notFound();
  }

  const subscription = await getPrisma().subscription.findUnique({
    where: { tenantId: tenant.id },
    include: { plan: true },
  });

  if (!subscription) {
    return (
      <div>
        <PageHeader title="Assinatura" description="Plano atual, fatura em aberto e histórico." />
        <EmptyState icon={CreditCard} title="Sem assinatura" description="Nenhuma assinatura encontrada para esta empresa. Contate o suporte." />
      </div>
    );
  }

  const now = new Date();
  const status = effectiveStatus(subscription, now);

  const openInvoice = await getPrisma().invoice.findFirst({
    where: { subscriptionId: subscription.id, status: "OPEN" },
    orderBy: { periodStart: "desc" },
  });

  const snapshot: BillingSnapshot = {
    planName: subscription.plan.name,
    priceCents: subscription.plan.priceCents,
    status,
    trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    timezone: tenant.timezone,
    invoice: openInvoice
      ? {
          amountCents: openInvoice.amountCents,
          dueAt: openInvoice.dueAt.toISOString(),
          pixCopyPaste: openInvoice.pixCopyPaste,
          pixExpiresAt: openInvoice.pixExpiresAt?.toISOString() ?? null,
          paidAt: openInvoice.paidAt?.toISOString() ?? null,
        }
      : null,
  };

  return <AssinaturaClient snapshot={snapshot} />;
}
