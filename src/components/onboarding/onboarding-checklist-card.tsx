"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/components/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { dismissOnboardingChecklistAction } from "@/modules/onboarding/actions";
import type { OnboardingState } from "@/modules/onboarding/service";
import { InnoAvatar, InnoFull } from "./inno-mascot";
import { CHECKLIST_STEPS, CHECKLIST_UI } from "./inno-script";

/**
 * Card "Primeiros passos" do Início. O estado (`steps`, `allDone`) vem calculado pelo servidor —
 * aqui só se desenha e se esconde. "Esconder" e "Fechar" chamam a mesma action; o card some na
 * hora (otimista) e volta, com aviso, se o servidor recusar.
 */
export function OnboardingChecklistCard({ tenantSlug, state }: { tenantSlug: string; state: OnboardingState }) {
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (hidden) return null;

  function dismiss() {
    setError(null);
    setHidden(true);
    startTransition(async () => {
      try {
        const result = await dismissOnboardingChecklistAction(tenantSlug);
        if (!result.ok) {
          setHidden(false);
          setError(CHECKLIST_UI.error);
        }
      } catch {
        setHidden(false);
        setError(CHECKLIST_UI.error);
      }
    });
  }

  const doneByKey = new Map(state.steps.map((s) => [s.key, s.done]));
  const items = CHECKLIST_STEPS.map((s) => ({ ...s, done: doneByKey.get(s.key) ?? false }));
  const doneCount = items.filter((i) => i.done).length;
  const percent = Math.round((doneCount / items.length) * 100);
  const nextKey = items.find((i) => !i.done)?.key;

  if (state.allDone) {
    return (
      <Card className="mb-6 rounded-hero-lg border-success/30 bg-success-bg/40" data-tour="checklist">
        <div className="flex flex-col items-center gap-4 p-5 text-center sm:flex-row sm:p-6 sm:text-left">
          <InnoFull className="w-20 shrink-0 sm:w-24" />
          <div className="min-w-0 flex-1" role="status">
            <h2 className="font-display text-xl font-bold text-text">{CHECKLIST_UI.doneTitle}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{CHECKLIST_UI.doneBody}</p>
            {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
          </div>
          <Button type="button" variant="primary" onClick={dismiss} isLoading={pending} className="w-full shrink-0 sm:w-auto">
            {CHECKLIST_UI.close}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-6 rounded-hero-lg" data-tour="checklist">
      <div className="grid gap-x-6 gap-y-4 p-5 sm:p-6 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <InnoAvatar size={44} className="md:hidden" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-xl font-bold text-text">{CHECKLIST_UI.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-text-secondary">{CHECKLIST_UI.intro}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label={CHECKLIST_UI.title}
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={doneCount}
              aria-valuetext={CHECKLIST_UI.progress(doneCount, items.length)}
              className="h-2 flex-1 overflow-hidden rounded-full bg-border"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-text-secondary">
              {CHECKLIST_UI.progress(doneCount, items.length)}
            </span>
          </div>

          <ol className="mt-4 divide-y divide-border rounded-card border border-border">
            {items.map((item, i) => (
              <li key={item.key} className="flex items-center gap-3 p-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    item.done ? "bg-success text-white" : "border border-border bg-bg text-text-secondary",
                  )}
                >
                  {item.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", item.done ? "text-text-secondary line-through" : "text-text")}>
                    {item.title}
                    {item.done ? <span className="sr-only"> — {CHECKLIST_UI.done}</span> : null}
                  </p>
                  {item.done ? null : <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{item.description}</p>}
                </div>
                {item.done ? null : (
                  <Button
                    asChild
                    size="sm"
                    variant={item.key === nextKey ? "primary" : "outline"}
                    className="shrink-0"
                  >
                    <Link href={`/${tenantSlug}/${item.path}`} aria-label={`${item.cta}: ${item.title}`}>
                      {item.cta}
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-3 flex items-center justify-between gap-3">
            {error ? <p className="text-sm text-danger">{error}</p> : <span />}
            <button
              type="button"
              onClick={dismiss}
              aria-label={CHECKLIST_UI.hideLabel}
              className={cn(
                "inline-flex min-h-11 items-center rounded-card px-3 text-xs font-medium text-text-secondary underline-offset-4 hover:text-text hover:underline",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              )}
            >
              {CHECKLIST_UI.hide}
            </button>
          </div>
        </div>

        <div className="hidden items-end md:flex">
          <InnoFull className="w-28 lg:w-32" />
        </div>
      </div>
    </Card>
  );
}
