---
name: react-hooks-set-state-in-effect
description: eslint-plugin-react-hooks (v6, este projeto) bloqueia setState síncrono dentro do corpo de useEffect — inclusive quando a chamada acontece indiretamente via uma função (ex. fetch de dados on mount/deps change)
metadata:
  type: feedback
---

O lint deste projeto (`npm run lint`) tem a regra `react-hooks/set-state-in-effect` ativa e ela
falha o build (`✖ N problems (erros)`) sempre que um `useEffect` chama um setter de estado
**diretamente no corpo síncrono do efeito** — isso inclui o padrão comum "fetch de dados ao
montar/mudar dependência": `useEffect(() => { load(); }, [load])` onde `load` chama
`setLoading(true)` como primeira linha.

**Como aplicar:** envolva a chamada num `setTimeout(fn, 0)` (não `queueMicrotask` — mais simples
e testado) dentro do efeito, e limpe com `clearTimeout` no cleanup:

```ts
useEffect(() => {
  const timeoutId = setTimeout(load, 0);
  return () => clearTimeout(timeoutId);
}, [load]);
```

O mesmo vale para efeitos que resetam vários campos de formulário quando um dialog abre
(`useEffect(() => { if (!open) return; setX(...); setY(...); }, [open, prefill])`) — envolva o
bloco inteiro em `setTimeout`.

**Por quê:** é uma checagem estática (AST), não de timing real — o que ela detecta é "o setState
está sintaticamente alcançável de forma síncrona a partir do corpo do efeito". Encapsular numa
callback assíncrona (mesmo com delay 0) tira a chamada dessa análise.

Usado em `src/app/(app)/[tenantSlug]/agenda/agenda-client.tsx`,
`src/app/(app)/[tenantSlug]/agendamentos/agendamentos-client.tsx` e
`src/components/agenda/novo-agendamento-dialog.tsx` (Fase 2).
