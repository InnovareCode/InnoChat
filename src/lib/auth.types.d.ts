import type { DefaultSession } from "next-auth";

// Módulo de aumento de tipos do Auth.js — adiciona `id` à sessão e ao JWT,
// que por padrão só trazem name/email/image.
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

// "next-auth/jwt" só reexporta de "@auth/core/jwt" (`export * from`), então
// a interface JWT precisa ser aumentada onde ela é DE FATO declarada —
// aumentar "next-auth/jwt" cria um merge que não flui para os call sites.
declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
  }
}
