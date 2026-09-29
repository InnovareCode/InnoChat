# Manual do Cliente — InnoChat

Bem-vind@! Este manual é para você, dona da clínica, salão ou negócio de serviços. Aqui você aprende a usar o InnoChat do início ao fim, sem jargão técnico.

---

## Índice

1. [Criar a conta](#criar-a-conta)
2. [Confirmar o e-mail](#confirmar-o-e-mail)
3. [Teste gratuito e pagamento](#teste-gratuito-e-pagamento)
4. [Primeiros passos (Onboarding)](#primeiros-passos-onboarding)
5. [Como seu cliente agenda via WhatsApp](#como-seu-cliente-agenda-via-whatsapp)
6. [Gerenciar a Agenda](#gerenciar-a-agenda)
7. [Ver e gerenciar Clientes](#ver-e-gerenciar-clientes)
8. [Editar textos do bot](#editar-textos-do-bot)
9. [Temas e aparência](#temas-e-aparência)
10. [Equipe](#equipe)
11. [O que acontece se a assinatura vencer](#o-que-acontece-se-a-assinatura-vencer)
12. [Perguntas frequentes](#perguntas-frequentes)

---

## Criar a conta

1. Acesse **www.innochat.com.br** (ou o domínio da sua plataforma).
2. Clique em **"Cadastro"** ou **"Criar conta"**.
3. Preencha:
   - **Nome da empresa** (seu salão, clínica, etc.)
   - **Seu nome** (proprietário ou gerente)
   - **E-mail** (será usado para login e receber cobranças)
   - **Senha** (forte, com letras, números e símbolos)
   - Aceite os **Termos de uso** e **Política de privacidade**
4. Clique em **"Cadastrar"**.

Pronto! Você acaba de criar uma conta em teste gratuito de **3 dias**.

---

## Confirmar o e-mail

1. Você receberá um e-mail de confirmação de `noreply@innochat.com.br`.
2. Clique no link dentro do e-mail.
3. Se não receber em 5 minutos, clique em **"Reenviar"** na tela de login.

⚠️ **Aviso:** você só consegue conectar seu WhatsApp após confirmar o e-mail. O resto do painel funciona normalmente.

---

## Teste gratuito e pagamento

**Primeiros 3 dias:** seu painel completo e bot funcionando, sem cobrar nada.

**No 4º dia:** o teste vence. Para continuar:

1. Abra o painel.
2. Vá em **Conta → Assinatura**.
3. Escolha um plano:
   - **Essencial** — até 1 número de WhatsApp, até 3 profissionais
   - **Profissional** — até 2 números, até 10 profissionais
   - **Clínica** — até 3 números, profissionais ilimitados
4. Um **QR do Pix** aparece na tela.
5. Abra seu app de banco, escaneie o QR ou copie o código e cole no seu banco.
6. Pague pelo Pix.

**Confirmação:** assim que seu banco confirmar o pagamento, você pode seguir usando o InnoChat por mais um mês. O QR é gerado para vencer em 3 dias; se ele vencer sem pagamento, você pode gerar um novo na mesma tela.

---

## Primeiros passos (Onboarding)

Assim que faz login pela primeira vez, o painel mostra um guia em **4 passos**:

### Passo 1: Cadastrar serviços

No menu esquerdo, vá em **Catálogo → Serviços**.

1. Clique em **+ Novo serviço**.
2. Preencha:
   - **Nome** (ex.: "Corte feminino", "Limpeza de pele")
   - **Duração** (quanto tempo leva, em minutos)
   - **Intervalo** (se tem descanso entre clientes — deixe em branco se não souber)
   - **Preço** (opcional; se deixar vazio, o bot não mostra preço no menu)
   - **Ativo** (sempre marque para aparecer no bot)
3. Salve.

Repita para cada serviço que você oferece.

### Passo 2: Cadastrar profissionais e expediente

No menu esquerdo, vá em **Catálogo → Profissionais**.

1. Clique em **+ Novo profissional**.
2. Preencha:
   - **Nome** (ex.: "Ana", "Dr. Carlos")
   - **Serviços** que ele/ela oferece (marque as caixinhas)
   - **Ativo** (sempre marque)
3. Clique em **Expediente** (abaixo do nome).
4. Defina os dias e horas que trabalha (ex.: seg–sex, 09:00–18:00, seg 14:00–15:00 folga).
5. Salve.

Se houver feriados ou folgas, vá em **Operação → Agenda** e defina bloqueios.

### Passo 3: Conectar WhatsApp

No menu esquerdo, vá em **Canal → WhatsApp**.

1. Clique em **+ Conectar número**.
2. Um **QR code** aparece na tela.
3. **Use um smartphone com WhatsApp instalado** (pode ser pessoal, mas recomendamos um número dedicado).
4. Abra o WhatsApp, clique em **Configurações → Aparelhos conectados → Conectar um aparelho** (ou similar, dependendo do celular).
5. Escaneie o QR com a câmera do celular.
6. Confirme.
7. Espere a conexão aparecer como **"Conectado"** na tela.

⚠️ **Importante:** use um número de WhatsApp dedicado ao bot, não seu número pessoal. Cada resposta do bot saindo do seu número pode confundir clientes.

Se a conexão cair, você pode reconectar clicando no número e gerando um novo QR.

### Passo 4: Testar o bot

No painel, você vê um link com instruções. Simplesmente abra o WhatsApp conectado e envie **"oi"** para si mesmo ou para um colega. O bot deve responder com um menu.

---

## Como seu cliente agenda via WhatsApp

Seu cliente envia uma mensagem (qualquer coisa) para o número do WhatsApp que você conectou.

O bot responde com um **menu numerado**:

```
1. Agendar
2. Meus agendamentos
3. Falar com um atendente
0. Menu principal
```

### Agendar (opção 1)

1. Cliente digita **"1"**.
2. Bot mostra os serviços: **"1. Corte feminino — R$ 80,00"**, **"2. Limpeza de pele"**, etc.
3. Cliente escolhe: **"1"**.
4. Bot mostra os profissionais (se houver mais de um): **"1. Ana"**, **"2. Beatriz"**, etc.
5. Cliente escolhe ou **"0"** volta ao menu principal.
6. Bot mostra os dias com vaga: **"1. Ter 30/09"**, **"2. Qua 01/10"**, etc.
7. Cliente escolhe um dia.
8. Bot mostra horários: **"1. 14:30"**, **"2. 15:00"**, **"3. 16:30"**, etc.
9. Cliente escolhe um horário.
10. Bot pede para confirmar: **"Confirmar?"** com **"1. Sim"** e **"2. Escolher outro horário"**.
11. Se o cliente confirma, o bot diz: **"Agendado para terça 30/09 às 14:30!"** e volta ao menu.
12. Se nenhum horário sobrou, o bot oferece: **"Falar com um atendente"**.

### Meus agendamentos (opção 2)

1. Cliente digita **"2"**.
2. Bot mostra os agendamentos futuros: **"1. Terça 30/09 14:30 — Corte feminino (Ana)"**, etc.
3. Cliente escolhe um ou **"0"** volta.
4. Bot pergunta o que fazer:
   - **"1. Cancelar"** — cancela, pede confirmação.
   - **"2. Remarcar"** — leva de novo pelo fluxo de escolher dia/hora.
5. Pronto.

⚠️ **Cancela no último momento?** Se estiver muito perto (ex.: 2 horas antes), o bot responde: **"Muito perto para cancelar. Falar com um atendente?"**.

### Falar com um atendente (opção 3)

Se o cliente digita **"3"** ou escolhe "Falar com atendente", você recebe um aviso no painel e pode responder pessoalmente por WhatsApp. O bot fica em pausa para aquele cliente.

---

## Gerenciar a Agenda

No menu esquerdo, vá em **Operação → Agenda**.

### Visão por dia

1. Escolha a data (topo).
2. Veja todos os agendamentos do dia, organizados por profissional.
3. Você pode:
   - **Clicar em um agendamento** para ver detalhes (nome do cliente, telefone, serviço).
   - **Marcar como "Concluído"** quando o cliente saiu.
   - **Marcar como "Não compareceu"** se não apareceu.
   - **Deletar** um agendamento (com cuidado).

### Agendar manualmente

1. Clique no horário vazio que quer ocupar.
2. Um formulário abre: escolha cliente (ou crie um novo), serviço, profissional, data e hora.
3. Salve.

### Arrastar para remarcar

Você pode **clicar e arrastar** um agendamento para outro horário (se estiver vazio e disponível).

---

## Ver e gerenciar Clientes

No menu esquerdo, vá em **Operação → Clientes**.

Aqui você vê todos os contatos que já interagiram com o bot.

### Editar informações

1. Clique no nome do cliente.
2. Veja:
   - Nome (você pode editar)
   - Número de WhatsApp
   - Agendamentos passados e futuros
3. Clique em **"Editar"** para mudar o nome.

### Pausar o bot para um cliente

Se você quer atender um cliente pessoalmente (por WhatsApp) sem o bot interferir:

1. Abra o cliente.
2. Clique em **"Pausar o bot"**.
3. O bot fica quieto para aquele cliente pelos próximos 12 horas.
4. Depois de 12 horas, o bot volta automaticamente.

---

## Editar textos do bot

No menu esquerdo, vá em **Canal → Mensagens do bot**.

Aqui você edita os textos que o bot envia (mantendo os padrões se não souber o que mudar).

### Textos editáveis

- **Olá** — primeira mensagem (ex.: "Oi, tudo bem? Como posso ajudar?")
- **Menu principal** — as opções (você NÃO pode alterar os números, só os textos)
- **Escolher serviço**, **Escolher profissional**, **Escolher dia**, **Escolher horário** — títulos dos menus
- **Agendado** — mensagem de sucesso
- **Não há horários** — quando não há vaga no dia escolhido
- **Confirmação** — texto antes de confirmar o agendamento

E mais:

- Mensagens de erro ("escolha uma opção válida", "nós não entendi")
- Mensagens de controle ("sessão expirou", "falar com atendente")

### Editar um texto

1. Encontre o texto na lista.
2. Clique em **"Editar"**.
3. Você pode usar **variáveis** dentro do texto:
   - `{nome}` — nome do cliente
   - `{empresa}` — nome da sua empresa
   - `{servico}` — nome do serviço escolhido
   - `{profissional}` — nome do profissional
   - `{data}` — data do agendamento (ex.: "Ter 30/09")
   - `{hora}` — hora (ex.: "14:30")
   - `{preco}` — preço do serviço

Exemplo:
```
Olá {nome}! Bem-vind@ à {empresa}. 

1. Agendar
2. Meus agendamentos
3. Falar com um atendente
```

4. Clique em **"Salvar"**.
5. Clique em **"Restaurar padrão"** se quiser voltar à versão original.

---

## Temas e aparência

No menu esquerdo, vá em **Conta → Configurações**.

Escolha um de **3 temas**:

- **Clínico (padrão)** — azul profissional
- **Studio** — laranja e dourado
- **Natural** — verde suave

O tema muda a cor do painel e dos botões. O bot no WhatsApp não é afetado (o cliente vê apenas texto).

---

## Equipe

No menu esquerdo, vá em **Conta → Configurações**.

Clique em **"Equipe"**.

### Convidar alguém

1. Clique em **"+ Convidar"**.
2. Preencha o e-mail da pessoa.
3. Escolha o papel:
   - **Proprietário** — acesso total (pode editar configurações, gerenciamento de equipe)
   - **Membro** — acesso ao painel, não pode alterar configurações
4. Clique em **"Enviar convite"**.
5. A pessoa recebe um e-mail com um link para aceitar.

### Remover alguém

1. Encontre a pessoa na lista.
2. Clique em **"Remover"**.

---

## O que acontece se a assinatura vencer

### Se você não pagar no prazo

1. Seu painel fica **somente leitura** — você vê a agenda e clientes, mas não pode criar, editar nem conectar nada.
2. Seu bot **para de responder** — clientes veem o número, mas o bot não responde mensagens.
3. Um **banner vermelho** aparece pedindo pagamento urgente.

### Como reativar

1. Vá em **Conta → Assinatura**.
2. Gere um novo QR do Pix e pague.
3. Assim que seu banco confirmar, tudo volta ao normal.

### Se ficar muito tempo vencido

Após **60 dias** sem pagar, sua conta é **cancelada**. Os dados são guardados por **90 dias** e depois **apagados** (é a Lei de Proteção de Dados — LGPD — que exige isso).

---

## Perguntas frequentes

### P: Posso usar meu número pessoal de WhatsApp para o bot?

**R:** Tecnicamente sim, mas não recomendamos. Cada resposta do bot será vista como se você estivesse respondendo, e clientes podem ficar confusos. Use um número dedicado — até um ramal ou chip pré-pago serve.

### P: Quanto custa?

**R:** Teste de 3 dias é grátis. Depois, os planos começam em **R$ 59,90/mês** (Essencial). Veja a tela de Assinatura para preços exatos.

### P: O bot pode responder com imagens ou vídeos?

**R:** Não na v1. O bot só envia textos numerados. Se um cliente enviar imagem, o bot responde: "Só consigo entender mensagens de texto".

### P: Quantos clientes posso ter?

**R:** Sem limite. O limite é no número de profissionais e números de WhatsApp, dependendo do plano.

### P: Posso remarcar um agendamento pela agenda, não pelo bot?

**R:** Sim. Abra a **Agenda**, clique no agendamento e escolha "Remarcar". Ou clique e arraste para outro horário.

### P: Preciso pagar taxa por mensagem?

**R:** Não. Você paga um valor fixo por mês, e todas as mensagens são inclusas. O WhatsApp usa banda do seu internet; não há custo extra por texto enviado/recebido.

### P: Meu bot parou de responder. O que faço?

**R:** Verifique:
1. Sua assinatura está **Ativa**? (vá em **Conta → Assinatura**)
2. O WhatsApp está **Conectado**? (vá em **Canal → WhatsApp** e veja o status)
3. Seu e-mail está **confirmado**? (você recebeu um e-mail de confirmação?)

Se tudo estiver ok e o bot continua mudo, entre em contato com o suporte.

### P: Como faço para cancelar minha conta?

**R:** Vá em **Conta → Assinatura** e clique em **"Cancelar assinatura"**. Seus dados serão guardados por 90 dias e depois apagados.

### P: Posso exportar minha lista de clientes?

**R:** Sim. Na página **Operação → Clientes**, procure o botão **"Exportar (CSV)"** — você baixa uma planilha com todos os dados.

### P: Meu cliente digitou "0" e voltou ao menu. Ele perdeu o agendamento?

**R:** Não. O agendamento só é confirmado quando o cliente escolhe a opção **"1. Confirmar"** no final. Se ele digitar "0" ou "Menu", a operação é cancelada e ele volta ao início.

---

## Precisa de ajuda?

- Consulte este manual novamente.
- Abra o **Chat de suporte** (canto inferior direito do painel).
- E-mail: **suporte@innochat.com.br**.

Estamos aqui para ajudar! 😊
