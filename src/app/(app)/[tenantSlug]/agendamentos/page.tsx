import { listProfessionalsAction, listServicesAction } from "@/modules/agenda/catalog-actions";
import { AgendamentosClient } from "./agendamentos-client";
import type { ProfessionalRow } from "../profissionais/profissionais-client";
import type { ServiceRow } from "../servicos/servicos-client";

export default async function AgendamentosPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const [professionalsResult, servicesResult] = await Promise.all([
    listProfessionalsAction(tenantSlug),
    listServicesAction(tenantSlug),
  ]);

  const professionals = professionalsResult.ok ? (professionalsResult.data as ProfessionalRow[]) : [];
  const services = servicesResult.ok ? (servicesResult.data as ServiceRow[]) : [];

  return <AgendamentosClient tenantSlug={tenantSlug} professionals={professionals} services={services} />;
}
