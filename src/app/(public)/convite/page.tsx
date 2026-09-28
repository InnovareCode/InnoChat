import type { Metadata } from "next";
import { ConviteForm } from "./convite-form";

export const metadata: Metadata = { title: "Aceitar convite — InnoChat" };

export default async function ConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <ConviteForm token={token ?? null} />
      </div>
    </main>
  );
}
