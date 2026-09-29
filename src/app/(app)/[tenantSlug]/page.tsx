import { redirect } from "next/navigation";

export default async function TenantIndexPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/inicio`);
}
