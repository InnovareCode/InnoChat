---
name: bug-icone-server-para-client
description: "Bug de UI recorrente: passar NavItem[] (com componente de ícone lucide-react) como prop de Server Component para Client Component quebra o build — como evitar"
metadata:
  type: feedback
---

Ao montar o shell do painel (`PanelShell`/`AdminShell`, Server Components)
passando a lista de itens de navegação (`{ label, href, icon: LucideIcon }`)
como prop para `SidebarNav`/`MobileNav` (Client Components), o Next.js
quebrou em runtime com: *"Only plain objects can be passed to Client
Components from Server Components. Classes or other objects with methods
are not supported."* — apontando exatamente para o campo `icon`.

**Why:** um componente React (função) não é serializável através da
fronteira servidor/cliente do App Router. Isso vale para QUALQUER prop que
carregue um componente como valor (ícone, render prop de outro componente
etc.), não só ícones — só apareceu aqui porque `NavItem.icon` é
`LucideIcon`. `cat -n`/lint/typecheck/build **não pegam isso**: só aparece
em runtime (SSR), por isso a skill `medir-antes-de-afirmar` importa — rodar
no navegador de verdade é o que revela.

**How to apply:** nunca passar um array/objeto que contenha um componente
React como prop de Server Component para Client Component. Duas saídas que
funcionam:
1. O Client Component importa os dados diretamente (import de módulo, não
   prop) — é o que `src/components/shell/sidebar-nav.tsx` faz hoje
   (`TenantSidebarNav`/`AdminSidebarNav` chamam `tenantNavItems()` por
   dentro, recebendo só primitivos como `tenantSlug`).
2. Se o valor SÓ pode vir de fora, passar como `children`/prop **já
   renderizado** (um elemento JSX, não a referência ao componente) — é
   assim que `LogoutButton` (Server Component com Server Action) chega
   dentro do `MobileNav` (Client Component): como `footer={<LogoutButton />}`,
   nunca como `footer: typeof LogoutButton`.

Ver também: mesmo cuidado vale para qualquer prop que carregue uma função
não serializável (callback de servidor, classe do Prisma etc.) — o
princípio é o mesmo, ícone foi só o primeiro caso encontrado neste projeto.
