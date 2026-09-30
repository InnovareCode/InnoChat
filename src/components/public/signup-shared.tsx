import Link from "next/link";

/** Seção visual do formulário de cadastro (só agrupamento — a submissão segue um formulário único). */
export function FormSection({
  step,
  title,
  id,
  children,
}: {
  step: number;
  title: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="flex items-center gap-2.5 font-display text-sm font-bold text-text">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold tabular-nums text-primary ring-1 ring-primary/25"
        >
          {step}
        </span>
        {title}
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">{children}</div>
    </section>
  );
}

/** Aceite dos Termos de uso e da Política de privacidade (checkbox com 20px + rótulo clicável). */
export function TermsCheckbox({
  checked,
  onChange,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-3 rounded-card bg-bg/70 p-3 text-sm text-text ring-1 ring-border">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "acceptedTerms-error" : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-border accent-primary"
        />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="text-primary hover:underline">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="text-primary hover:underline">
            Política de privacidade
          </Link>
          .
        </span>
      </label>
      {error ? (
        <p id="acceptedTerms-error" role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
