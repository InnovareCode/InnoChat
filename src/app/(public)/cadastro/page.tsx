import Link from "next/link";
import { UserPlus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function CadastroPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <EmptyState
        icon={UserPlus}
        title="Cadastro chega na próxima fase"
        description="O cadastro público e a assinatura entram no painel na Fase 7 (docs/arquitetura.md §13). Por enquanto, quem já tem conta pode entrar."
        action={
          <Button asChild>
            <Link href="/login">Ir para o login</Link>
          </Button>
        }
      />
    </main>
  );
}
