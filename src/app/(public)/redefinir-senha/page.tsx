import type { Metadata } from "next";
import { PublicSplitLayout } from "@/components/public/public-split-layout";
import { RedefinirSenhaForm } from "./redefinir-senha-form";

export const metadata: Metadata = { title: "Redefinir senha — InnoChat" };

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <PublicSplitLayout>
      <RedefinirSenhaForm token={token ?? null} />
    </PublicSplitLayout>
  );
}
