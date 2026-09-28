import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

/**
 * Botão de sair — sempre visível na topbar (pedido explícito do dono).
 * Server Action inline: não precisa de client JS nem de rota própria.
 */
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm" className={className ?? "gap-2"}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </form>
  );
}
