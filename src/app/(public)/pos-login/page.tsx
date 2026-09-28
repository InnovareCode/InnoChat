import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/db/prisma";

/**
 * Ponte sem UI entre "login OK" e "painel certo". Roda depois que o cookie
 * de sessão já foi gravado (`login/actions.ts`), então só decide para onde ir:
 * primeira empresa do usuário, ou o admin da plataforma, ou de volta ao
 * login com um aviso. Não é uma tela — só lê e redireciona.
 */
export default async function PosLoginPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getPrisma().user.findUnique({
    where: { id: session.user.id },
    select: {
      isPlatformAdmin: true,
      memberships: {
        select: { tenant: { select: { slug: true } } },
        take: 1,
      },
    },
  });

  const tenantSlug = user?.memberships[0]?.tenant.slug;
  if (tenantSlug) {
    redirect(`/${tenantSlug}/agenda`);
  }
  if (user?.isPlatformAdmin) {
    redirect("/admin/empresas");
  }
  redirect("/login?erro=sem-empresa");
}
