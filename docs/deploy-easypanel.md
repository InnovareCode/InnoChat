# Deploy do InnoChat no Easypanel — guia passo a passo

Este guia é para você (o dono), sem pressupor conhecimento técnico prévio de Docker ou
Easypanel. Segue a ordem real das telas. Onde algo é irreversível ou arriscado, está em
**negrito com ⚠️**.

Antes de começar, tenha em mãos:
- Acesso ao painel do Easypanel na sua VPS (o mesmo onde já roda a Evolution API e o
  InnoAtendente).
- Um domínio ou subdomínio livre para o InnoChat (ex.: `innochat.innovarecode.com.br`), já
  apontado (registro DNS tipo A) para o IP da VPS — pergunte ao seu provedor de domínio se tiver
  dúvida de como fazer isso; é o mesmo passo que você já fez para o InnoAtendente.
- Este repositório (`https://github.com/InnovareCode/InnoChat`, branch `main`) acessível pelo
  Easypanel (mesma conta/integração GitHub que já usa nos outros projetos).

---

## 1. Criar o banco de dados (Postgres)

1. No Easypanel, dentro do seu projeto (ou crie um projeto novo chamado `innochat`), clique em
   **+ Serviço** → **Postgres** (é um template pronto, não precisa de Dockerfile).
2. Dê o nome `innochat-banco` (ou similar — só não repita o nome de bancos de outros projetos).
3. Deixe a versão padrão (Postgres 17/18) e crie.
4. Espere o serviço ficar "Running" (verde). Abra o serviço e copie a **connection string**
   interna que o Easypanel gera (algo como
   `postgresql://usuario:senha@innochat-banco:5432/innochat` — o nome do host é o nome do
   serviço, porque os dois containers ficam na mesma rede interna do Easypanel). **Guarde essa
   string** — você vai usá-la no passo 3.

**Por quê banco próprio:** o InnoChat não compartilha banco com o InnoAtendente nem com a
Evolution — é um projeto separado, com seus próprios dados (docs/arquitetura.md §0).

---

## 2. Criar o App (o painel do InnoChat) a partir do GitHub

1. No mesmo projeto, **+ Serviço** → **App**.
2. Nome: `innochat-painel`.
3. Em **Origem** (Source), escolha **GitHub**, selecione o repositório `InnovareCode/InnoChat` e
   a branch `main`.
4. Em **Construção** (Build), escolha o método **Dockerfile**. O campo **Arquivo** deve ficar
   `Dockerfile` (é o padrão — este repositório só tem um Dockerfile, um serviço só, sem
   ambiguidade de qual arquivo usar).
5. **Não clique em Deploy ainda** — primeiro configure as env vars (passo 3).

---

## 3. As duas variáveis de ambiente (e só essas duas)

Vá na aba **Ambiente** (Environment) do serviço `innochat-painel`. Você vai cadastrar **exatamente
duas** variáveis — tudo o mais (Evolution, n8n, Mercado Pago, e-mail) é configurado depois, de
dentro do próprio painel, na tela de administração (passo 8). Isso é proposital: menos segredo
solto em painel de infraestrutura, mais fácil de trocar sem precisar de um redeploy.

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a connection string que você copiou no passo 1 |
| `AUTH_SECRET` | um valor aleatório forte — gere com `openssl rand -base64 32` num terminal, ou peça para alguém da squad gerar. **Guarde uma cópia seu, fora do Easypanel** (ex.: gerenciador de senhas) — se precisar recriar o serviço do zero um dia, usar o MESMO valor evita deslogar todo mundo à força |

⚠️ **Ao colar cada valor, cole o valor INTEIRO no campo, substituindo qualquer coisa que já
esteja lá — nunca acrescente ao que já existe.** Um incidente real em outro projeto
(InnoAtendente) quebrou a aplicação porque um novo valor foi colado *depois* de uma vírgula, em
vez de substituir o campo por completo, e o código passou a receber dois valores colados em um
só. Se o campo já tiver algo (mesmo que pareça "gerado automaticamente"), apague tudo antes de
colar o valor novo.

Não crie nenhuma outra variável aqui — nem `NEXT_PUBLIC_APP_URL`, nem chave da Evolution, nem
nada do Mercado Pago. Isso é decisão do projeto (docs/arquitetura.md §14): o resto mora dentro do
banco, editável pela tela de admin, nunca em texto solto no painel de infraestrutura.

---

## 4. Domínio e HTTPS

1. Na aba **Domínios** do serviço `innochat-painel`, adicione o domínio que você já apontou por
   DNS (ex.: `innochat.innovarecode.com.br`).
2. Marque para gerar certificado HTTPS automático (Let's Encrypt) — é a opção padrão do
   Easypanel.
3. **Não é preciso guardar essa URL em nenhuma variável de ambiente.** O InnoChat descobre a
   própria URL pública sozinho, a partir da requisição — é só configurar o domínio aqui e seguir.

---

## 5. Primeiro deploy

1. Volte para a aba principal do serviço e clique em **Deploy**.
2. Acompanhe os logs de build — o processo instala dependências, gera o Prisma Client e builda
   o Next.js. Leva alguns minutos na primeira vez.
3. Quando o deploy terminar, o serviço deve ficar "Running", mas **o site ainda vai dar erro se
   você abrir agora** — falta a migration (próximo passo). É esperado.

---

## 6. Migration do banco (passo manual, sempre antes de qualquer schema novo)

**Desde 2026-09-29 as migrations rodam sozinhas** no início do container
(`CMD` do `Dockerfile`: `prisma migrate deploy && node server.js`). Não é preciso rodar nada no
Console a cada deploy. O comando manual continua disponível para diagnóstico:

1. No serviço `innochat-painel`, abra a aba **Console** (ou "Terminal").
2. Rode:
   ```
   npx prisma migrate deploy
   ```
3. A resposta esperada é "No pending migrations" (o boot já aplicou tudo).

**Por que mudou:** o comando pelo Console roda dentro do container já publicado, que só conhece as
migrations da versão anterior, então "migrar antes do push" era impossível e o site ficava com
erro até alguém rodar o comando depois do deploy. Se a migration falhar no boot, o container novo
não sobe (a versão anterior continua no ar) e o log do serviço mostra o erro do Prisma.

**Se der erro no meio da migration:** não rode de novo automaticamente — chame a squad
(Cronos/Vega) para investigar. O Prisma marca cada migration como aplicada só depois que ela
termina com sucesso; uma falha no meio deixa um registro "falhou" que precisa de
`prisma migrate resolve` para ser destravado, e isso é melhor decidido olhando o erro exato.

---

## 7. Pegar o código de instalação e criar o primeiro administrador

1. Na aba **Logs** do serviço `innochat-painel`, procure uma linha assim (aparece só uma vez, no
   boot, e só enquanto não existir nenhum administrador):
   ```
   InnoChat: código de instalação = XXXXXXXX (válido por 24h, use em /instalacao)
   ```
2. Copie esse código.
3. Abra `https://<seu-domínio>/instalacao` no navegador.
4. Preencha o código, seu nome, e-mail e uma senha forte. Isso cria o primeiro usuário
   administrador da plataforma (`isPlatformAdmin`).
5. **Se o código expirar (24h) ou você não encontrar a linha no log:** reinicie o serviço
   (restart, não precisa de novo deploy) — o InnoChat gera um código novo a cada boot, enquanto
   não houver administrador.
6. Depois que o primeiro admin existir, `/instalacao` para de funcionar sozinho (responde
   "página não encontrada" de propósito, para não ficar uma porta aberta).

---

## 8. Configurar as integrações pelo painel (Admin → Configurações)

Faça login com o admin criado no passo 7 e vá em **Admin → Configurações**. Todos os campos de
segredo aparecem mascarados depois de salvos (nunca voltam em texto puro) — se digitar errado,
basta salvar de novo.

### Evolution API
- `evolutionApiUrl`: a URL da sua instância da Evolution (a mesma que já usa no InnoAtendente).
- `evolutionApiKey`: a chave global da Evolution.
- Depois de salvar, use o botão **"Testar conexão"** para confirmar que o InnoChat consegue
  falar com a Evolution antes de conectar qualquer número de WhatsApp.

### n8n
- `n8nBaseUrl`: URL base da sua instância n8n (para a API do n8n, se usada).
- `n8nWebhookBaseUrl`: URL base dos webhooks do n8n (o `n8n/README.md` no repositório explica o
  formato exato esperado pelo workflow `innochat-bot`).
- `n8nApiKey`: se aplicável à sua instância.
- Gere o **segredo interno da API** (botão de gerar/regenerar) — ele aparece em texto puro **uma
  única vez**, na hora. Copie e cole na credencial *Header Auth* do n8n imediatamente; se perder,
  precisa gerar outro (o InnoChat só guarda o hash, nunca o valor).
- Depois que os números de WhatsApp estiverem conectados (Fase 3), use **"Reaplicar webhook em
  todas as instâncias"** sempre que a URL do n8n mudar — evita ter que reconectar cada número na
  mão.
- Use **"Testar conexão"** para confirmar antes de seguir.

### SMTP (e-mail transacional)
- Host, porta, usuário, senha e remetente do seu provedor de SMTP.
- **"Testar conexão"** envia um e-mail de teste — confirme que chegou antes de liberar o cadastro
  público (verificação de e-mail depende disso).

### Mercado Pago
- `mercadoPagoAccessToken` e `mercadoPagoWebhookSecret` (produção — peça ao dono da conta MP se
  não for você mesmo).
- **URL do webhook a cadastrar no painel do Mercado Pago:**
  `https://<seu-domínio>/api/webhooks/mercadopago`
  Cadastre essa URL na conta do Mercado Pago (Notificações → Webhooks) para os eventos de
  pagamento Pix. Sem isso, um Pix pago nunca vai "baixar" a fatura automaticamente no InnoChat.
- **"Testar conexão"** confirma que o token é válido antes de ativar cobrança de verdade.

### Termos de uso e privacidade
- Cole o texto (ou a versão) dos termos vigentes — o cadastro público grava a versão aceita por
  cada empresa.

---

## 9. Agendamento do `billing/tick` (cobrança diária)

O InnoChat tem um endpoint interno que processa cobrança (gera faturas vencendo, expira Pix,
muda status de assinatura): `POST /api/internal/v1/billing/tick`, autenticado com
`Authorization: Bearer <segredo interno gerado no passo 8>`.

**Decisão recomendada: disparar pelo n8n**, com um workflow agendado (Schedule Trigger, de hora
em hora) chamando esse endpoint com o Bearer, igual ao padrão que o `innochat-bot` já usa para
falar com o painel. Vantagens sobre um cron do Easypanel: fica no mesmo lugar onde a squad já
audita e versiona workflows (`n8n/*.json` no repositório), sem precisar de acesso SSH/console
para configurar ou trocar o horário.

**Este guia NÃO cria esse workflow agora** — é registrado aqui como pendência para o Atlas
montar (`innochat-cron`, junto com o `innochat-bot`, via MCP do n8n — docs/arquitetura.md §6.6,
§13 Fase 5). Alternativa, se preferir não depender do n8n para isso: o Easypanel tem um recurso
de **Cron Jobs** (agendamento próprio, roda um comando dentro do container) — poderia rodar
`curl -X POST https://<domínio>/api/internal/v1/billing/tick -H "Authorization: Bearer <segredo>"`
uma vez por hora, mas isso deixaria o segredo interno solto num campo de cron do Easypanel, contra
a decisão de manter segredo só no banco/n8n. **Recomendado: n8n.**

---

## 10. Ativar o bot (depois que a Fase 5 — workflow n8n — estiver pronta)

1. Confirme que o workflow `innochat-bot` está publicado no n8n (não a versão de rascunho).
2. No painel, vá em **WhatsApp** (dentro da empresa) → **Conectar número** → escaneie o QR.
3. Envie "oi" pelo número conectado e confirme que o menu responde.
4. Só depois disso oriente empresas reais a conectar seus números.

---

## 10b. Confirmar o health check no Easypanel (rollback automático)

O `Dockerfile` já declara um `HEALTHCHECK` (`GET /api/health` a cada 30s) — isso é o container se
reportando ao Docker. **Confira na tela do serviço `innochat-painel` (procure por "Health Check"
nas configurações avançadas do serviço) se o Easypanel tem um campo próprio para apontar o
caminho `/api/health`** e, se tiver, preencha — isso é o que garante que um deploy com o banco
fora do ar (ou qualquer outro problema que o health check pega) **não fique no ar sozinho**,
revertendo automaticamente. Não existia registro anterior desta configuração específica na
interface real do Easypanel deste projeto — confirme olhando a tela, não assuma pelo nome do
campo.

## 11. Checklist de verificação pós-deploy

Depois de QUALQUER deploy (primeiro ou os seguintes), confirme, nesta ordem:

- [ ] `GET https://<domínio>/api/health` responde `200` com `{"status":"ok"}` (prova que o
      processo subiu E consegue falar com o Postgres — não só que a porta está de pé).
- [ ] O serviço aparece "Running" (verde) no Easypanel, sem reiniciar em loop.
- [ ] Login com o admin funciona.
- [ ] Se o deploy incluiu migration nova: ela foi aplicada (passo 6) **antes** de testar qualquer
      tela que dependa da tabela/coluna nova.
- [ ] Nenhuma tela de Configurações mostra segredo em texto puro (deve sempre vir mascarado).
- [ ] Se o deploy tocou WhatsApp/bot: mandar uma mensagem de teste real e confirmar resposta.

Se `/api/health` responder `503` ou não responder, **não conecte números novos nem anuncie o
deploy** — é sinal de banco fora do ar ou `DATABASE_URL` errada; volte ao passo 3 antes de
qualquer outra investigação.

---

## 12. Rollback

Se algo quebrar depois de um deploy:

1. No Easypanel, aba **Deployments** (ou "Implantações") do serviço `innochat-painel`, escolha o
   deploy anterior (o que estava funcionando) e clique em **Reverter/Redeploy**.
2. ⚠️ **Migration nunca desfaz sozinha.** Se o deploy problemático incluiu uma migration nova
   (passo 6), o rollback da IMAGEM não desfaz o que já foi mudado no banco. Por isso, toda
   migration deste projeto é escrita para ser **aditiva** (adiciona coluna/tabela nova, nunca
   remove ou renomeia o que o código anterior ainda usa) — a squad segue essa regra
   deliberadamente para que reverter a imagem sempre seja seguro, mesmo que a migration mais
   recente já tenha rodado. Se algum dia uma migration destrutiva for realmente necessária, ela
   precisa ser feita em duas etapas (parar de usar a coluna antiga no código, esperar esse deploy
   estabilizar, só depois remover a coluna numa migration separada) — combine com a squad antes
   de aceitar uma migration assim.
3. Depois do rollback, rode o checklist do passo 11 de novo.

---

## 13. Backup do Postgres

**Duas camadas, use as duas:**

1. **Backup automático do Easypanel**: na aba de backups do serviço `innochat-banco`, ative
   backup agendado (diário é razoável para o volume esperado no 1º ano — docs/arquitetura.md
   §0). O Easypanel guarda os arquivos por um tempo configurável.
2. **`pg_dump` agendado como segunda rede** (independe do Easypanel continuar de pé): rode, de um
   lugar fora da VPS (seu computador, ou outro servidor) com acesso à connection string do passo
   1:
   ```
   pg_dump "postgresql://usuario:senha@<host-externo>:5432/innochat" -Fc -f innochat-$(date +%Y%m%d).dump
   ```
   Agende isso (ex.: uma tarefa agendada do seu sistema, ou um workflow do n8n com um nó de
   execução de comando, se preferir manter tudo num lugar só) para rodar diariamente e guardar os
   últimos ~14 dumps em outro local (não na mesma VPS).

**Restauração — teste isto pelo menos uma vez, num banco separado, ANTES de precisar de verdade:**

1. Crie um Postgres temporário (outro serviço no Easypanel, ou local) só para o teste.
2. Restaure:
   ```
   pg_restore -d "postgresql://usuario:senha@<host-do-banco-temporario>:5432/innochat_restore_test" innochat-AAAAMMDD.dump
   ```
3. Confirme que as tabelas principais têm dados (`SELECT count(*) FROM "Tenant";`, por exemplo).
4. Apague o banco temporário depois do teste.

**Se precisar restaurar de verdade em produção:** pare o serviço `innochat-painel` primeiro
(evita escrita durante a restauração), restaure sobre o banco real, confira os dados, e só então
suba o serviço de novo. Isso é uma operação rara e arriscada — combine com a squad antes de fazer
isso sozinho.

---

## Referência rápida

| O que | Onde |
|---|---|
| Variáveis de ambiente do App | `DATABASE_URL`, `AUTH_SECRET` — só essas duas |
| Tudo o mais (Evolution, n8n, MP, SMTP) | Admin → Configurações, dentro do painel |
| Código de instalação do 1º admin | Log do container, no boot, até existir um admin |
| Migration | Automática no boot do container (`Dockerfile`); Console só para diagnóstico |
| Health check | `GET /api/health` |
| Webhook do Mercado Pago | `https://<domínio>/api/webhooks/mercadopago` |
| `billing/tick` (cobrança diária) | `POST /api/internal/v1/billing/tick`, Bearer — via workflow agendado no n8n (a montar, Fase 5) |
| Rollback | Aba Deployments do Easypanel; migrations são sempre aditivas, então é seguro |
