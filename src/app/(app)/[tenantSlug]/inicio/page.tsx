import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CalendarPlus, CalendarRange, MessageCircle, Percent, Plus, Scissors, UserX, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatDateTimeLabel } from "@/components/lib/format-date";
import { DomainError } from "@/lib/errors";
import { getDashboardView } from "@/modules/dashboard/queries";
import { InicioChart } from "./inicio-chart";

/**
 * Página "Início" (docs/design/premium-spec.md §10) — a leitura de dados vem inteira de
 * `src/modules/dashboard/queries.ts` (exceção de escopo autorizada pelo Atlas: só leitura,
 * escopo por tenant). Erro de leitura vira mensagem explícita, nunca uma página em branco.
 */
export default async function InicioPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  let view;
  try {
    view = await getDashboardView(tenantSlug);
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      notFound();
    }
    return (
      <div>
        <PageHeader title="Início" />
        <EmptyState
          title="Não foi possível carregar o resumo agora"
          description="Tente recarregar a página em alguns instantes. Se o problema continuar, fale com o suporte."
        />
      </div>
    );
  }

  const hasAnyActivity = view.dailySeries.some((p) => p.count > 0) || view.upcoming.length > 0;

  return (
    <div>
      <PageHeader
        title="Início"
        description="O resumo do seu negócio hoje."
        action={
          <Link
            href={`/${tenantSlug}/agenda`}
            className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-4 text-sm font-medium text-white hover:bg-primary-strong"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo agendamento
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          index={0}
          size="hero"
          icon={<CalendarClock aria-hidden="true" strokeWidth={1.5} />}
          label="Agendamentos hoje"
          value={view.appointmentsToday}
          tone="primary"
          context="não cancelados"
        />
        <StatCard
          index={1}
          icon={<CalendarRange aria-hidden="true" strokeWidth={1.5} />}
          label="Próximos 7 dias"
          value={view.appointmentsNext7Days}
          tone="primary"
          context="agendamentos previstos"
        />
        <StatCard
          index={2}
          icon={<UserX aria-hidden="true" strokeWidth={1.5} />}
          label="Taxa de faltas"
          value={view.noShowRatePercent}
          suffix="%"
          tone={view.noShowRatePercent > 20 ? "danger" : "success"}
          context="últimos 30 dias"
        />
        <StatCard
          index={3}
          icon={<Percent aria-hidden="true" strokeWidth={1.5} />}
          label="Agendado pelo bot"
          value={view.botSharePercent}
          suffix="%"
          tone="primary"
          context="últimos 30 dias"
        />
        <StatCard
          index={4}
          icon={<MessageCircle aria-hidden="true" strokeWidth={1.5} />}
          label="WhatsApp conectado"
          value={view.connectedWhatsappCount}
          tone={view.connectedWhatsappCount > 0 ? "success" : "warning"}
          context={`de ${view.totalWhatsappCount} número(s)`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-hero lg:col-span-2">
          <CardHeader>
            <CardTitle>Agendamentos por dia</CardTitle>
          </CardHeader>
          <CardContent>
            {hasAnyActivity ? (
              <InicioChart data={view.dailySeries} />
            ) : (
              <EmptyState
                variant="highlight"
                icon={CalendarPlus}
                title="Ainda sem agendamentos no período"
                description="O gráfico aparece assim que os primeiros agendamentos entrarem, pelo painel ou pelo bot."
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-hero">
          <CardHeader>
            <CardTitle>Próximos agendamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {view.upcoming.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={CalendarClock}
                  title="Nada agendado ainda"
                  description="Os próximos agendamentos aparecem aqui, do mais próximo para o mais distante."
                />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {view.upcoming.map((appt, index) => (
                  <li key={appt.id} className="flex items-center gap-3 p-4">
                    <span className="relative flex h-2 w-2 shrink-0">
                      {index === 0 ? (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" aria-hidden="true" />
                      ) : null}
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{appt.serviceName}</p>
                      <p className="truncate text-xs text-text-secondary">
                        {appt.contactName ?? "Sem nome"} · {appt.professionalName}
                      </p>
                    </div>
                    <Badge variant="primary" className="shrink-0 tabular-nums">
                      {formatDateTimeLabel(appt.startsAt, view.timezone)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ShortcutCard href={`/${tenantSlug}/agenda`} icon={CalendarPlus} label="Novo agendamento" />
        <ShortcutCard href={`/${tenantSlug}/clientes`} icon={UserPlus} label="Novo cliente" />
        <ShortcutCard href={`/${tenantSlug}/servicos`} icon={Scissors} label="Gerenciar serviços" />
      </div>
    </div>
  );
}

function ShortcutCard({ href, icon: Icon, label }: { href: string; icon: typeof CalendarPlus; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-hero border border-border bg-surface p-4 text-sm font-medium text-text transition-colors duration-150 hover:border-primary/30 hover:bg-bg motion-reduce:transition-none"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      {label}
    </Link>
  );
}
