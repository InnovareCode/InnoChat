import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/modules/auth/service";
import { clientIp } from "@/lib/http/client-ip";

/**
 * Auth.js v5 — Credentials (e-mail + senha) com sessão JWT.
 *
 * Sem `PrismaAdapter`: o schema (Cronos, docs/arquitetura.md §5) não tem
 * `Account`/`Session`/`VerificationToken` (os models que o adapter padrão do
 * Auth.js espera) — não há provider OAuth na v1, e a sessão é JWT (sem
 * sessão em banco). `AuthToken` (verificação de e-mail, redefinição de
 * senha, convite) é modelo próprio, gerido por `src/modules/auth/service.ts`,
 * não pelo adapter. Se um provider OAuth entrar pós-v1, revisitar aqui.
 *
 * `authorize()` NUNCA toca Prisma diretamente: chama
 * `src/modules/auth/service.ts` — mesma regra das server actions
 * (docs/arquitetura.md §10: "app → modules → core").
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  // Sem isto, Auth.js v5 recusa requisições atrás de um proxy reverso que
  // ele não reconhece automaticamente (Easypanel/Traefik não é detectado
  // como Vercel/Netlify) — erro genérico "problem with the server
  // configuration". Seguro aqui: o domínio público já é fixado por
  // AUTH_URL/NEXT_PUBLIC_APP_URL (um único domínio, arquitetura.md §14).
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const ip = await clientIp();
        return verifyCredentials({
          email: String(credentials?.email ?? ""),
          password: String(credentials?.password ?? ""),
          ip,
        });
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
