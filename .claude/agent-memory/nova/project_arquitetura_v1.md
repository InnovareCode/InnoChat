---
name: project-arquitetura-v1
description: Arquitetura do InnoChat v1 (v2 do doc, 2026-09-28) — motor do menu nos nós do n8n por decisão do dono; painel guarda as garantias; cadastro público + Pix MP
metadata:
  type: project
---

Fonte da verdade: `docs/arquitetura.md` (não duplicar aqui). Seções mudaram de número na v2: fases §13, decisões §15.

Eu recomendei o motor do menu no painel; o DONO DECIDIU (2026-09-28) que fica nos nós do n8n, visual e
editável. Não reabrir. Desenho resultante: n8n decide o próximo passo; o painel concentra o que é caro errar
num `POST /messages/claim` (normalização/@lid, dedupe InboundEvent, lease da ChatSession, expiração, modo
humano, eco fromMe, assinatura) + endpoints granulares; reserva com EXCLUDE devolve 409 + alternativas.
Textos por tenant ficam no painel (`BotText`), n8n só referencia `textKey` — texto ≠ fluxo.

**Why:** o dono quer poder ver e editar o fluxo; a perda de garantia (reserva e sessão em transações
separadas, lease em vez de lock transacional, sem teste unitário do fluxo) foi registrada como risco e
mitigada com idempotência, version+lockToken e bateria de roteiros numa instância sandbox.

**How to apply:** qualquer proposta nova deve manter regra transacional/segurança no painel e deixar
só o roteamento no n8n. Mudança no workflow exige export do JSON para `n8n/` e rodar a bateria.

Também decidido pelo dono: cadastro público + assinatura na v1 (Mercado Pago Pix pontual, mesma escolha
do InnoAtendente); sem histórico de conversa; lembretes pós-v1.

Relacionados: [[reference-innoatendente-licoes]], [[project-evolution-baileys-limites]]
