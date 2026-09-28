import Link from "next/link";
import { Palette, Building2, Clock, Users2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  {
    href: "aparencia",
    icon: Palette,
    title: "Aparência",
    description: "Escolha o tema visual do painel da sua empresa.",
    ready: true,
  },
  {
    href: "empresa",
    icon: Building2,
    title: "Empresa",
    description: "Nome, segmento e fuso horário.",
    ready: false,
  },
  {
    href: "agenda",
    icon: Clock,
    title: "Regras de agenda e do bot",
    description: "Antecedência mínima, horizonte máximo, timeout da sessão.",
    ready: false,
  },
  {
    href: "equipe",
    icon: Users2,
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

  return (
    <div>
      <PageHeader title="Configurações" description="Empresa, regras de agenda e do bot, equipe." />
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Card key={section.href} className={!section.ready ? "opacity-60" : undefined}>
            <CardContent>
              <section.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 font-display text-sm font-bold text-text">{section.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{section.description}</p>
              {section.ready ? (
                <Link
                  href={`/${tenantSlug}/configuracoes/${section.href}`}
                  className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Abrir
                </Link>
              ) : (
                <p className="mt-3 text-xs text-text-secondary">Chega em uma próxima fase.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
