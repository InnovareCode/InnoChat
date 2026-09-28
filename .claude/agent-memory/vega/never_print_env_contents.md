---
name: never-print-env-contents
description: Nunca rodar um comando que imprime o conteúdo do .env (nem "só a parte não sensível") — mesmo um regex que tenta ocultar a senha pode falhar e vazar a connection string inteira no transcript
metadata:
  type: feedback
---

Ao debugar por que um script Node não lia `DATABASE_URL` corretamente (Fase 7, cobrança), rodei
`node -e "...console.log(m[1].replace(...))"` para "confirmar que o regex achou a URL, só
mostrando a parte depois da senha" — o `replace` não cobriu o trecho esperado e a senha real do
Postgres (`<senha-local-redigida>`) apareceu em texto puro no output do Bash, visível no transcript da
sessão.

**Por quê:** qualquer comando que passa o conteúdo do `.env` (ou de uma `DATABASE_URL` completa)
por `console.log`/`echo`/`cat` arrisca vazar a senha se a lógica de mascaramento tiver um bug —
e só se descobre o bug DEPOIS que já vazou. Não existe "só um pedacinho seguro" de uma connection
string: ela inteira é segredo.

**Como aplicar:** para depurar scripts que leem `.env` (ex.: o wrapper de
[[run_with_test_db_wrapper]] que deriva `TEST_DATABASE_URL`), nunca imprimir nenhuma variável
derivada do arquivo, nem para debug "temporário". Passar a env var derivada direto para o
processo filho (`spawnSync(..., { env })`) e verificar o resultado pelo COMPORTAMENTO do comando
(código de saída, se a migration/teste passou), nunca pelo valor da própria URL. Se precisar
confirmar que o parse funcionou, comparar só o COMPRIMENTO da string ou um hash, nunca o valor.
