import Link from "next/link";
import { Calendar, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Calendar,
    title: "Agenda sem fricção",
    description: "Serviços, profissionais e horários — sua equipe organiza tudo em um só lugar.",
  },
  {
    icon: MessageCircle,
    title: "Atendimento pelo WhatsApp",
    description: "O bot agenda, remarca e cancela pelo número que sua empresa já usa.",
  },
  {
    icon: ShieldCheck,
    title: "Cada empresa isolada",
    description: "Dados, conversas e agenda de cada cliente ficam só com ele.",
  },
];

export default function LandingPage() {
  return (
    <main>
      <header className="flex items-center justify-between px-4 py-5 sm:px-8">
        <span className="font-display text-lg font-bold text-text">InnoChat</span>
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/cadastro">Criar conta</Link>
          </Button>
        </nav>
      </header>

      <section className="px-4 py-16 text-center sm:px-8">
        <h1 className="mx-auto max-w-2xl font-display text-3xl font-bold text-text sm:text-4xl">
          Agenda e atendimento no WhatsApp, num painel só.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-text-secondary">
          O InnoChat cuida da agenda do seu negócio e responde seus clientes no WhatsApp — sem
          perder um horário.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/cadastro">Começar agora</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/login">Já tenho conta</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto grid max-w-4xl gap-4 px-4 pb-16 sm:grid-cols-3 sm:px-8">
        {FEATURES.map((feature) => (
          <Card key={feature.title}>
            <CardContent>
              <feature.icon className="h-6 w-6 text-primary" aria-hidden="true" />
              <p className="mt-3 font-display text-sm font-bold text-text">{feature.title}</p>
              <p className="mt-1 text-sm text-text-secondary">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
