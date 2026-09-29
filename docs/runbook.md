# Runbook — Operação InnoChat

Manual de operação para o dono/admin da plataforma. Cobre monitoramento, incidentes, backup e procedimentos de manutenção.

---

## Índice

1. [Rotinas automáticas](#rotinas-automáticas)
2. [Monitorar a saúde](#monitorar-a-saúde)
3. [Incidentes comuns](#incidentes-comuns)
4. [Rotação de segredos](#rotação-de-segredos)
5. [Backup e restauração](#backup-e-restauração)
6. [Rollback de deploy](#rollback-de-deploy)
7. [Publicar nova versão dos termos](#publicar-nova-versão-dos-termos)

---

## Rotinas automáticas

O InnoChat executa três tarefas automáticas, todas via workflow `innochat-cron` no n8n:

### Faturamento horário (`billing/tick`)

**Frequência:** a cada hora (minuto 5)

**O que faz:**
- Gera novas faturas para empresas cujo período está vencendo (5 dias antes)
- Gera QR Pix para faturas abertas (válido por 3 dias)
- Marca faturas como `EXPIRED` se o Pix venceu sem pagamento
- Atualiza o status da assinatura: `TRIALING` → `ACTIVE` (se pagou), `ACTIVE` → `PAST_DUE` (se venceu), `PAST_DUE` → `SUSPENDED` (após 1 dia de carência)
- Envia e-mails de aviso (geração, 1 dia antes do vencimento, no vencimento)

**Logs:** vá em **Admin → Saúde** e veja a seção "Último tick de cobrança" — deve mostrar um timestamp recente. Se estiver estagnado, há um problema.

**Quando rodar:** todo dia, 24/7 automaticamente. Se o cron falhar, `effectiveStatus()` ainda calcula status correto sob demanda, então acesso não é bloqueado — mas faturas não são geradas.

### Manutenção diária (`maintenance/tick`)

**Frequência:** diariamente às 03:15 (horário do servidor)

**O que faz:**
- Purga `InboundEvent` mais antigos que 30 dias (LGPD)
- Anonimiza contatos de tenants `CANCELED` há mais de 90 dias (apaga nome, número, tudo)
- Processa em lotes de 500 para não sobrecarregar

**Resposta esperada:**
```json
{
  "inboundEventsPurged": 1234,
  "contactsAnonymized": 5
}
```

**Logs:** **Admin → Saúde** mostra "Última manutenção" — se estiver vermelho ou vazio, avisa.

### Sincronização n8n (manual)

**Quando:** após editar URLs ou regenerar segredo interno da API

**Como:** vá em **Admin → Configurações da plataforma**, clique em **"Sincronizar n8n"**. Isso:
- Reescreve os placeholders (`painelUrl`, `evolutionUrl`, `n8nApiUrl`) nos nós `Config` dos workflows
- Reaplica as credenciais (redireciona para a interface do n8n)

Se o n8n estiver offline, a sincronização falha; tente de novo mais tarde.

---

## Monitorar a saúde

Vá em **Admin → Saúde** (tela reservada para visualizar status em tempo real).

### Seções

1. **Status geral**
   - URL do painel (descoberta automaticamente)
   - Última execução do `billing/tick` e `maintenance/tick`
   - Bot ativo/inativo

2. **Instâncias WhatsApp**
   - Lista de todas as instâncias conectadas
   - Status: `CONNECTED`, `DISCONNECTED`, `QRCODE_WAITING`
   - Se alguma estiver `DISCONNECTED`, aparece um aviso — a empresa precisa reconectar

3. **Eventos com erro**
   - `InboundEvent` que chegaram com problemas (ex.: remetente desconhecido, mensagem descarapada)
   - Helpful para diagnosticar problemas de Evolution

4. **Mensagens ocupadas**
   - Quantas mensagens ficaram esperando porque a sessão estava travada
   - Se esse número crescer muito nas últimas 24h, há concorrência anormal — investigar

5. **Saúde do n8n**
   - Últimas execuções com erro dos workflows (bot, cron, erros)
   - Links para abrir no n8n

### API de saúde

```bash
GET /api/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "database": "connected",
  "n8n": "connected",
  "timestamp": "2026-09-28T22:15:30Z"
}
```

Se o banco ou n8n estiver indisponível, o status fica `degraded` ou `error`.

---

## Incidentes comuns

### Incidente 1: Bot parou de responder

**Sintomas:** cliente envia mensagem, bot fica mudo.

**Diagnóstico:**

1. Verifique a saúde (**Admin → Saúde**):
   - A instância WhatsApp está `CONNECTED`? Se não, a Evolution desconectou.
   - O `billing/tick` rodou recentemente? Se não, talvez o n8n esteja fora.
   - Há muitas mensagens "ocupadas" nas últimas 1h? Se sim, há gargalo.

2. Verifique o status da empresa (**Admin → Empresas**):
   - Assinatura em `TRIALING` ou `ACTIVE`? Se `SUSPENDED`, o bot foi bloqueado propositalmente.
   - Plano permite WhatsApp? Clique na empresa e veja o máximo de números.

3. Verifique o n8n (**Admin → Configurações da plataforma**):
   - `n8nWebhookBaseUrl` está preenchido? Se não, o bot não recebe mensagens.
   - Os workflows `innochat-bot` estão ativos? Entre no n8n e ativa se preciso.

**Ações:**

- Se a Evolution desconectou: a empresa precisa reconectar o WhatsApp (**Canal → WhatsApp** → gerar novo QR).
- Se o n8n está offline: espere a infraestrutura voltar ou reinicie o container do n8n.
- Se a assinatura está `SUSPENDED`: você pode reativar manualmente (**Admin → Empresas → Ações → Reativar**) ou a empresa paga a fatura (**Conta → Assinatura**).

### Incidente 2: WhatsApp desconecta sozinho

**Sintomas:** instância fica `DISCONNECTED`, os clientes veem "não conectado" no painel.

**Causa comum:** sessão expirou ou Evolution foi reiniciada.

**Ação:**
1. A empresa reconecta (**Canal → WhatsApp** → gera novo QR).
2. Se desconectar repetidamente (a cada poucas horas), há problema com a Evolution — investigue a versão ou chave da API.

### Incidente 3: Pix não confirma (fatura vencida sem marcar como paga)

**Sintomas:** cliente pagou, viu a confirmação no banco, mas fatura no InnoChat continua `OPEN`.

**Causa:** webhook do Mercado Pago não chegou ou foi descartado.

**Diagnóstico:**

1. No banco de dados, verifique se `ProviderEvent` tem um registro com o ID do pagamento:
   ```sql
   SELECT * FROM provider_events WHERE payload->>'id' = '<payment-id>' LIMIT 1;
   ```

2. Se tem, significa o webhook chegou mas o `processedAt` pode ter erro. Veja o `payload` para investigar.

3. Se não tem, o webhook não chegou. Verifique no painel do Mercado Pago:
   - Webhook URL está correto? (`https://seu-dominio/api/webhooks/mercadopago`)
   - Segredo do webhook (webhook secret) está correto? (**Admin → Configurações da plataforma**)

**Ações:**

1. Corrija a URL ou segredo do webhook se estiver errado.
2. No Mercado Pago, resend o webhook manualmente (Histórico de webhooks → ação de resend).
3. Se o webhook for recebido de novo e ainda falhar, há bug no tratamento — investigue os logs do painel.

**Solução manual (último recurso):**
- Você pode marcar a fatura como paga manualmente via SQL ou banco de dados (mas isso é risco — prefira reconsultar a API do MP em vez de confiar só no webhook).

### Incidente 4: Taxa de limite de login alta

**Sintomas:** muitos IPs diferentes tentando fazer login na mesma conta.

**Causa:** força bruta ou conta comprometida.

**Ação:**
1. Peça ao cliente para trocar a senha imediatamente (**Conta → Esqueci a senha** no painel público).
2. Verifique os logs (se houver) para padrões de IP.
3. Se continuar, bloqueie o IP manualmente no servidor (fora do escopo do InnoChat — use firewall do Easypanel).

### Incidente 5: Mensagem sem resposta (o cliente nunca recebeu)

**Sintomas:** bot salvou a sessão e tentou enviar, mas a mensagem não chegou ao cliente.

**Causa:** Evolution falhou no `sendText` **depois** do `PUT /sessions`, então a trava foi liberada mas o envio não foi confirmado.

**Diagnóstico:**

1. Verifique `InboundEvent` para aquele cliente (tabela com histórico de entrada).
2. Se há um evento com `outcome = 'SENT'` e `stateAfter = 'SELECT_TIME'`, a sessão foi gravada mas a mensagem se perdeu — é raro e afeta 1 cliente.

**Ação:**
- O cliente pode repetir a última ação (reenviar "1" para serviço, etc.) e o bot reapresenta o `lastPrompt`.
- Se a sessão expirou antes de repetir, volta ao menu principal.

---

## Rotação de segredos

Procedimento para trocar credenciais sem derrubar a plataforma.

### Passo 1: Regenerar segredo interno (n8n)

Feito no painel (sem afetar produção):

1. Vá em **Admin → Configurações da plataforma**.
2. Clique em **"Regenerar segredo interno"**.
3. Um novo segredo é gerado e exibido **uma única vez** em texto puro.
4. ⚠️ **Copie esse segredo imediatamente** — ele nunca mais será exibido. Guarde em seu gerenciador de senhas.
5. Cole o novo segredo nos nós HTTP do n8n (credencial "InnoChat Painel (Bearer)").
6. Teste um webhook manualmente ou espere a próxima requisição do n8n.

### Passo 2: Atualizar outras credenciais (Evolution, Mercado Pago, SMTP)

1. Vá em **Admin → Configurações da plataforma**.
2. Localize o campo (ex.: `evolutionApiKey`).
3. **Selecione tudo** e substitua pelo novo valor — **nunca** acrescente.
4. Clique em **"Salvar"**.
5. O valor é guardado **cifrado** no banco (`enc:v1:`, AES-256-GCM; hash SHA-256 para o segredo interno) e mascarado na UI. Segredos antigos em texto puro são cifrados sozinhos na primeira leitura/gravação após o deploy.
6. Se for a chave da Evolution, reaplique para o n8n: **"Sincronizar n8n"**.

### Mercado Pago: trocar de ambiente (produção ↔ teste)

O Mercado Pago tem **dois pares** de credenciais (Access Token + Webhook Secret, mais a Public Key):
produção e teste (sandbox). Em **Admin → Configurações → Mercado Pago**:

1. Preencha o par do ambiente desejado (segredo em branco = mantém o já salvo) e use "Testar conexão".
2. Troque o seletor de **ambiente ativo**. Vale já na próxima requisição: Pix novo, tick e webhook usam o token/segredo do ambiente ativo.
3. O webhook do Mercado Pago valida a assinatura com o segredo do ambiente **ativo** — cadastre no painel do MP o webhook do modo correspondente (o de teste usa o segredo de teste).
4. **"Cobrança liberada"** desligada bloqueia só Pix/fatura NOVOS; pagamentos já feitos continuam sendo baixados pelo webhook.
5. "Remover credencial salva" apaga um segredo de um ambiente (irreversível: recadastre depois).

Sem access token + webhook secret do ambiente ativo, o Pix não é gerado e o webhook é rejeitado (401) — o painel mostra "Mercado Pago" como não configurado.

### ⚠️ Trocar o `AUTH_SECRET` apaga os segredos salvos

A chave que cifra os segredos da plataforma (Mercado Pago, Evolution, n8n, SMTP) é derivada do
`AUTH_SECRET`. Se ele for trocado (rotação, ou variável errada no Easypanel), nenhum segredo salvo
decifra mais: eles passam a valer como **ausentes** (Pix não gera, webhook do MP é rejeitado,
e-mail e Evolution/n8n deixam de funcionar) até serem **recadastrados** em Admin → Configurações.
Também invalida as sessões de login (comportamento do Auth.js). Antes de trocar: anote/tenha à mão
as credenciais de todas as integrações. Sintoma de troca acidental: logs `platform.secret.undecryptable`
e a tela mostrando os segredos como "não salvos".

### Passo 3: Testar

- Se foi Evolution: envie uma mensagem de teste via `curl` ou pelo bot.
- Se foi Mercado Pago: tente gerar um Pix de teste.
- Se foi SMTP: use "Testar conexão" na mesma tela.

---

## Backup e restauração

### Backup automático (Easypanel)

O Easypanel faz backup automático do Postgres (verifique a configuração no painel do Easypanel — frequência, retenção).

### Backup manual (antes de operação arriscada)

```bash
# No console do Postgres
pg_dump innochat > innochat-backup-2026-09-28.sql

# Ou via Easypanel:
# Serviço Postgres → aba Backup → "Fazer backup agora"
```

### Restauração

```bash
# Parar a aplicação (Easypanel: Deploy → Pause)
# No console do Postgres:
psql innochat < innochat-backup-2026-09-28.sql

# Reiniciar (Easypanel: Deploy → Resume)
# Rodar migration se necessário: npx prisma migrate deploy
```

**Importante:** antes de restaurar, **sempre** faça um backup do estado atual (em caso de precisar de rollback do rollback).

Ver `docs/deploy-easypanel.md` para detalhes de infraestrutura.

---

## Rollback de deploy

Se um deploy quebrou algo:

### Opção 1: Reverter a imagem Docker (rápido)

1. No Easypanel, vá em **Serviço → Deployments** (histórico de deploys).
2. Encontre o deploy anterior que funcionava.
3. Clique em **"Redeployar"** naquela versão.
4. A imagem antiga sobe novamente.

**⚠️ Se o deploy anterior incluiu migration:** você precisa reverter a migration também:

```bash
# No console do Postgres
npx prisma migrate resolve  # se a migration ficou "em aberto"
npx prisma migrate reset --skip-generate  # reverter tudo (CUIDADO: deleta dados)
# OU, melhor:
# Restaurar do backup (seção acima)
```

### Opção 2: Reverter o código (mais seguro)

1. `git revert <commit-que-quebrou>` (cria um commit de desfazimento).
2. Push para `main`.
3. Espere o Easypanel fazer deploy automático (ou clique "Deploy" manualmente).
4. Se teve migration, rode `npx prisma migrate deploy` no console.

### Opção 3: Hotfix rápido

Se o problema é simples (ex.: typo em variável, URL errada):

1. Corrija no código.
2. Commit.
3. Push.
4. Espere deploy e, se precisar, rodep migration.

---

## Publicar nova versão dos termos

Os textos de "Termos de uso" e "Política de privacidade" são servidos do código. Para atualizá-los:

### Localizar os termos

Arquivo: `src/lib/legal.ts`

```typescript
export const TERMS_OF_SERVICE = `
Seus textos aqui...
`;

export const PRIVACY_POLICY = `
Seus textos aqui...
`;
```

### Atualizar

1. Abra `src/lib/legal.ts`.
2. Edite os textos dentro das strings.
3. Commit e push.
4. Deploy.

### Versionar

Dentro do painel, **Admin → Configurações da plataforma**, há um campo `termsVersion` (ex.: "1.0", "1.1"). 

Sempre que atualizar os termos:

1. Atualize `termsVersion` para algo como "2.0" (um número ou data, ex.: "2026-09-28").
2. Salve em **Configurações**.
3. Clientes já cadastrados veem um aviso: "Novos termos disponíveis — releia".
4. Eles precisam aceitar de novo para continuar usando.

### Contratos

A tabela `User.termsAcceptedAt` e `User.termsVersion` rastreiam qual versão cada usuário aceitou. Você pode consultar em **Admin → Empresas** quantos usuários ainda usam versão antiga (não existe tela, mas está no banco).

---

## Checklist de saúde (diário)

Rode este checklist manualmente uma vez ao dia ou configure um alerta:

- ✅ **Banco:** painel consegue conectar? (`/api/health` retorna `"database": "connected"`)
- ✅ **n8n:** workflows estão ativos? (vá em **Admin → Saúde** ou direto no n8n)
- ✅ **Faturamento:** `billing/tick` rodou nas últimas 2h? (**Admin → Saúde**)
- ✅ **Instâncias:** alguma WhatsApp está desconectada? (**Admin → Saúde**)
- ✅ **Erros:** há execuções do n8n com erro crítico? (**Admin → Saúde**)
- ✅ **Webhook MP:** último recebimento quando? (verificar banco: `SELECT MAX(createdAt) FROM provider_events;`)

Se algo estiver vermelho, abra um incidente acima.

---

## Contato e suporte

- **Documentação:** `docs/arquitetura.md`, `docs/contratos.md`
- **Squad técnica:** consulte via GitHub Issues ou Discord
- **Dono:** para decisões de negócio (preços, planos, recursos novos)

