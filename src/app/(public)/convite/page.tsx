import type { Metadata } from "next";
import { PublicSplitLayout } from "@/components/public/public-split-layout";
import { ConviteForm } from "./convite-form";

export const metadata: Metadata = { title: "Aceitar convite — InnoChat" };

export default async function ConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <PublicSplitLayout>
      <ConviteForm token={token ?? null} />
    </PublicSplitLayout>
  );
}
