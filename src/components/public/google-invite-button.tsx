"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { GoogleSubmitButton, OrDivider } from "@/components/public/google-button";
import { startGoogleInviteSignInAction } from "@/modules/google-auth/actions";

type State = { error: string | null };

/**
 * "Aceitar com Google" do convite. A action grava um cookie e redireciona para o Google (o redirect
 * propaga — sem try/catch); só volta aqui com um `Result` de falha (convite inválido/expirado).
 */
export function GoogleInviteButton({ token }: { token: string }) {
  const [state, formAction] = useActionState<State, FormData>(async () => {
    const result = await startGoogleInviteSignInAction({ token });
    return { error: result && !result.ok ? result.error.message : null };
  }, { error: null });

  return (
    <div className="flex flex-col gap-4">
      {state.error ? <Alert variant="danger">{state.error}</Alert> : null}
      <form action={formAction}>
        <GoogleSubmitButton label="Aceitar com Google" />
      </form>
      <OrDivider />
    </div>
  );
}
