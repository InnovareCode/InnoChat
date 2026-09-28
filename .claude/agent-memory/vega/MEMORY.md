# Memória — Vega (InnoChat)

- [getPrisma() é função, nunca Proxy](prisma_singleton.md) — lição do InnoAtendente, aplicada desde o início do InnoChat.
- [forTenant só escopa models com tenantId próprio](for_tenant_scope_limits.md) — lista exata e por quê alguns models ficam de fora.
- [Auth.js v5 sem PrismaAdapter no InnoChat](auth_sem_adapter.md) — schema não tem Account/Session/VerificationToken; só Credentials + JWT na v1.
- [Prisma não dá error.code para violação de EXCLUDE](prisma_exclude_violation_shape.md) — detectar por PrismaClientUnknownRequestError + "23P01" na mensagem.
- [create() tenant-scoped precisa de tenantId literal no data](fortenant_create_needs_literal_tenantid.md) — cosmético pro TS, forTenant sobrescreve em runtime mesmo assim.
- [Como rodar tests/integration no InnoChat](integration_tests_setup.md) — banco innochat_test, config vitest separada, sem precisar ler a senha do .env.
- [NUNCA imprimir conteúdo do .env, nem "só a parte segura"](never_print_env_contents.md) — incidente real: regex de mascaramento falhou e vazou a senha do Postgres no transcript.
- [Wrapper Node para rodar contra innochat_test](run_with_test_db_wrapper.md) — script pronto + bug de `process.argv.slice(2)` que fazia o comando falhar em silêncio.
- [createInvoiceForPeriod idempotente NÃO re-tenta Pix](invoice_idempotent_create_skips_pix_attach.md) — use `tryAttachPix` direto quando a fatura já foi criada por outro caminho (ex.: dentro de uma transação).
- [Integração precisa de fileParallelism:false](integration_tests_need_sequential_files.md) — billing/tick faz varredura global e colide com afterAll de outros arquivos rodando em paralelo.
- [Lease atômica da ChatSession via updateMany](chatsession_lease_atomic_update.md) — trava de 20s sem SELECT FOR UPDATE, padrão reusável para travas por prazo.
- [z.toJSONSchema quebra com z.coerce.date()](zod_openapi_date_coerce.md) — precisa de `unrepresentable: "any"` para gerar OpenAPI sem trocar de lib.
- [Estender função de domínio compartilhada, não forkar](extend_dont_fork_shared_domain_fn.md) — como o bot reaproveitou createAppointmentManual/cancel/reschedule da Fase 2.
- [Chave nova em BOT_TEXT_KEYS quebra Record exaustivo no frontend](bot_text_keys_ripple_to_frontend.md) — checar `Record<BotTextKeyLiteral,...>` (ex.: tela "Mensagens do bot") antes de fechar.
