"use client";

import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/components/lib/cn";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { saveThemeAction, type SaveThemeState } from "./actions";

type PanelTheme = "INDIGO_CLINICO" | "AMBAR_ESTUDIO" | "VERDE_SLATE";

const THEMES: { value: PanelTheme; label: string; description: string }[] = [
  { value: "INDIGO_CLINICO", label: "Índigo Clínico", description: "Institucional e confiável." },
  { value: "AMBAR_ESTUDIO", label: "Âmbar Estúdio", description: "Acolhedor, estilo boutique." },
  { value: "VERDE_SLATE", label: "Verde Slate", description: "Minimalista e denso, para uso o dia inteiro." },
];

const INITIAL_STATE: SaveThemeState = { ok: false, message: null };

/** Prévia isolada: o `data-theme` do card de amostra não afeta o resto da página. */
function ThemePreview({ theme }: { theme: PanelTheme }) {
  return (
    <div
      data-theme={theme}
      className="rounded-card border border-border bg-bg p-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-card bg-primary" />
        <div className="h-2 flex-1 rounded-full bg-surface" />
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="h-2 w-3/4 rounded-full bg-surface" />
        <div className="h-2 w-1/2 rounded-full bg-surface" />
      </div>
      <div className="mt-2 h-6 w-16 rounded-card bg-primary" />
    </div>
  );
}

export function AparenciaForm({ tenantSlug, currentTheme }: { tenantSlug: string; currentTheme: PanelTheme }) {
  const [selected, setSelected] = useState<PanelTheme>(currentTheme);
  const [state, formAction, isPending] = useActionState(saveThemeAction, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      {state.message ? <Alert variant={state.ok ? "success" : "info"}>{state.message}</Alert> : null}

      <div role="radiogroup" aria-label="Tema visual" className="grid gap-4 sm:grid-cols-3">
        {THEMES.map((theme) => {
          const active = selected === theme.value;
          return (
            <label
              key={theme.value}
              className={cn(
                "flex cursor-pointer flex-col gap-3 rounded-card border p-4",
                "focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
                active ? "border-primary ring-1 ring-primary" : "border-border hover:border-text-secondary",
              )}
            >
              <input
                type="radio"
                name="theme"
                value={theme.value}
                checked={active}
                onChange={() => setSelected(theme.value)}
                className="sr-only"
              />
              <ThemePreview theme={theme.value} />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-bold text-text">{theme.label}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">{theme.description}</p>
                </div>
                {active ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
              </div>
            </label>
          );
        })}
      </div>

      <div>
        <Button type="submit" isLoading={isPending} className="w-fit">
          Salvar tema
        </Button>
      </div>
    </form>
  );
}
