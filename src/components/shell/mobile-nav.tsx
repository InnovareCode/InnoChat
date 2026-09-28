"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/cn";
import { TenantSidebarNav, AdminSidebarNav } from "./sidebar-nav";

type MobileNavProps = {
  brand: React.ReactNode;
  footer: React.ReactNode;
} & (
  | { variant: "tenant"; tenantSlug: string; onboardingIncomplete?: boolean; whatsappNeedsAttention?: boolean }
  | { variant: "admin" }
);

/**
 * Hambúrguer + gaveta (drawer) para telas < 1024px (`lg`). Recebe `brand` e
 * `footer` já renderizados pelo Server Component pai (composição via
 * children/prop é permitida — o que não pode cruzar a fronteira
 * servidor/cliente é o array de itens com ícone, por isso a navegação é
 * resolvida aqui dentro por `variant`, não recebida como prop).
 */
export function MobileNav(props: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <RadixDialog.Root open={open} onOpenChange={setOpen}>
      <RadixDialog.Trigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 lg:hidden" />
        <RadixDialog.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar px-4 py-6 lg:hidden",
            "focus:outline-none",
          )}
        >
          <RadixDialog.Title className="sr-only">Menu de navegação</RadixDialog.Title>
          <div className="mb-8 px-2">{props.brand}</div>
          <div className="flex-1 overflow-y-auto">
            {props.variant === "tenant" ? (
              <TenantSidebarNav
                tenantSlug={props.tenantSlug}
                onboardingIncomplete={props.onboardingIncomplete}
                whatsappNeedsAttention={props.whatsappNeedsAttention}
                onNavigate={() => setOpen(false)}
              />
            ) : (
              <AdminSidebarNav onNavigate={() => setOpen(false)} />
            )}
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">{props.footer}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
