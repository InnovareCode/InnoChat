---
name: reference-innoatendente-licoes
description: Onde estão as lições reaproveitáveis do InnoAtendente (mesmo nicho, mesma Evolution do dono)
metadata:
  type: reference
---

`C:\Projetos\Web\InnoAtendente` — produto irmão (IA, sem n8n) que usa o MESMO servidor Evolution do dono.
- `docs/arquitetura.md` §4 (EXCLUDE anti double booking, fuso), §5 (forTenant), §12 riscos.
- `src/adapters/whatsapp/evolution/index.ts` — adaptador validado contra o servidor real (QR, connection.update,
  correção do 9º dígito BR em JID).
- `docs/deploy-easypanel.md` — um Dockerfile por serviço, migration manual, armadilhas de env var.
- `PROGRESSO.md` — tabela de decisões datadas (PlatformSettings/isPlatformAdmin, auto-deploy por Git ligado).
