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
 *
 * `iconOnly` esconde o rótulo em qualquer largura (uso no bloco de usuário compacto do rodapé
 * da sidebar, `user-block.tsx`) — sem isso, o `hidden sm:inline` padrão reaparece a partir de
 * 640px e quebra a caixa de 8×8 do avatar+sair.
 */
export function LogoutButton({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size={iconOnly ? "icon" : "sm"} className={className ?? "gap-2"} aria-label={iconOnly ? "Sair" : undefined}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span className={iconOnly ? "sr-only" : "hidden sm:inline"}>Sair</span>
      </Button>
    </form>
  );
}
