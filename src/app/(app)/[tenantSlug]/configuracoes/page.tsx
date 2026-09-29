import { notFound } from "next/navigation";
import { Palette, Building2, Clock, Users2, CalendarOff } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getPrisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { ConfiguracoesGrid, type ConfigSection } from "./configuracoes-grid";
import { EmpresaDocumentForm } from "./empresa-document-form";

const SECTIONS: ConfigSection[] = [
  {
    href: "aparencia",
    icon: <Palette aria-hidden="true" />,
    title: "Aparência",
    description: "Escolha o tema visual do painel da sua empresa.",
    ready: true,
  },
  {
    href: "empresa",
    icon: <Building2 aria-hidden="true" />,
    title: "Empresa",
    description: "Nome, segmento e fuso horário.",
    ready: false,
  },
  {
    href: "agenda",
    icon: <Clock aria-hidden="true" />,
    title: "Regras de agenda e do bot",
    description: "Antecedência mínima, horizonte máximo, timeout da sessão.",
    ready: false,
  },
  {
    href: "bloqueios",
    icon: <CalendarOff aria-hidden="true" />,
    title: "Bloqueios e feriados",
    description: "Períodos em que a empresa inteira não atende, para todos os profissionais.",
    ready: true,
  },
  {
    href: "equipe",
    icon: <Users2 aria-hidden="true" />,
    title: "Equipe",
    description: "Convide colegas para o painel.",
    ready: true,
  },
];

export default async function ConfiguracoesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  const tenant = await getPrisma().tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, document: true },
  });
  if (!tenant) {
    notFound();
  }

  const session = await auth();
  const membership = session?.user?.id
    ? await getPrisma().membership.findFirst({
        where: { userId: session.user.id, tenantId: tenant.id },
        select: { role: true },
      })
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configurações" description="Empresa, regras de agenda e do bot, equipe." />

      <EmpresaDocumentForm
        tenantSlug={tenantSlug}
        currentDocument={tenant.document}
        isOwner={membership?.role === "OWNER"}
      />

      <ConfiguracoesGrid tenantSlug={tenantSlug} sections={SECTIONS} />
    </div>
  );
}
