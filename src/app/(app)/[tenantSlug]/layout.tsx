import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import "@/app/globals.css";
import { fontVariables } from "@/app/fonts";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db/prisma";
import { effectiveStatus } from "@/core/billing";
import { ToastProvider } from "@/components/ui/toast";
import { PanelShell } from "@/components/shell/panel-shell";

export const metadata: Metadata = { title: "InnoChat — Painel" };

/**
 * Root layout do painel do tenant. Resolve o tema (`Tenant.theme`) e a
 * empresa NO SERVIDOR, antes de mandar HTML para o navegador — por isso
 * `data-theme` já sai certo no primeiro parágrafo de resposta, sem "flash"
 * do tema padrão.
 *
 * Proteção de rota (pedido explícito: "middleware ou layout"): feita aqui,
 * não em `middleware.ts`. Motivo: a checagem real não é só "tem sessão?" —
 * é "esse usuário tem Membership NESSE tenant?", o que exige ler o banco;
 * fazer isso em middleware duplicaria a consulta que o layout já precisa
 * fazer para montar o shell (nome da empresa, tema). Um usuário autenticado
 * sem vínculo com o tenant da URL recebe 404 (nunca 403 — não confirma que o
 * tenant existe para quem não é dele, mesma regra do contrato interno,
 * docs/arquitetura.md §6.1).
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await getPrisma().membership.findFirst({
    where: { userId: session.user.id, tenant: { slug: tenantSlug } },
    select: {
      tenant: { select: { id: true, name: true, theme: true } },
    },
  });

  if (!membership) {
    notFound();
  }

  // Status efetivo da assinatura (docs/arquitetura.md §7.4) para o banner global do painel —
  // sempre calculado sob demanda (`effectiveStatus`, puro), nunca confiando só no `status`
  // persistido (que só o `billing/tick` de hora em hora mantém em dia).
  const subscription = await getPrisma().subscription.findUnique({
    where: { tenantId: membership.tenant.id },
    select: { status: true, trialEndsAt: true, currentPeriodEnd: true },
  });
  const now = new Date();
  const status = subscription ? effectiveStatus(subscription, now) : null;
  const trialHoursLeft =
    status === "TRIALING" && subscription?.trialEndsAt
      ? Math.max(0, Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / (60 * 60 * 1000)))
      : null;

  // Onboarding (docs/arquitetura.md §13): incompleto enquanto não houver nenhum serviço OU
  // nenhum profissional com expediente cadastrado — o link "Primeiros passos" some da sidebar
  // assim que os dois existirem (WhatsApp fica de fora da checagem: ainda não tem tela).
  const [serviceCount, professionalWithHoursCount] = await Promise.all([
    getPrisma().service.count({ where: { tenantId: membership.tenant.id } }),
    getPrisma().professional.count({
      where: { tenantId: membership.tenant.id, workingHours: { some: {} } },
    }),
  ]);
  const onboardingIncomplete = serviceCount === 0 || professionalWithHoursCount === 0;

  return (
    <html lang="pt-BR" data-theme={membership.tenant.theme} className={fontVariables}>
      <body>
        <ToastProvider>
          <PanelShell
            tenantName={membership.tenant.name}
            tenantSlug={tenantSlug}
            userEmail={session.user.email ?? ""}
            subscriptionStatus={status}
            trialHoursLeft={trialHoursLeft}
            onboardingIncomplete={onboardingIncomplete}
          >
            {children}
          </PanelShell>
        </ToastProvider>
      </body>
    </html>
  );
}
