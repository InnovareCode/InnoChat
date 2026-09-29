"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/components/lib/cn";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadixDialog.Content>) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
      <RadixDialog.Content
        className={cn(
          "dialog-content-centered fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2",
          "rounded-card border border-border bg-surface p-6 shadow-card",
          "focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <RadixDialog.Close
          className={cn(
            "absolute right-4 top-4 rounded-card p-1 text-text-secondary hover:bg-bg",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
          aria-label="Fechar"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof RadixDialog.Title>) {
  return <RadixDialog.Title className={cn("font-display text-lg font-bold text-text", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof RadixDialog.Description>) {
  return <RadixDialog.Description className={cn("mt-1.5 text-sm text-text-secondary", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-6 flex justify-end gap-3", className)} {...props} />;
}
