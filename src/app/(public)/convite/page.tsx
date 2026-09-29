import type { Metadata } from "next";
import { AuthShell } from "@/components/public/auth-shell";
import { ConviteForm } from "./convite-form";

export const metadata: Metadata = { title: "Aceitar convite — InnoChat" };

export default async function ConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell>
      <ConviteForm token={token ?? null} />
    </AuthShell>
  );
}
