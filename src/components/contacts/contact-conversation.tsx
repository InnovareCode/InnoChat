"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckCheck, Loader2, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { cn } from "@/components/lib/cn";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatTimeLabel } from "@/components/lib/format-date";
import { ChatDoodle, WA_TOKENS } from "@/components/whatsapp/phone-mockup";
import { getConversationAction } from "@/modules/conversations/actions";
import {
  bubbleAriaLabel,
  groupConversationByDay,
  mergeConversation,
  type ConversationMessage,
} from "./conversation-utils";

type Status = "loading" | "ready" | "error";

/**
 * Histórico de conversa do cliente com o bot, no visual do WhatsApp (entrada à esquerda, saída do
 * bot à direita). SÓ LEITURA nesta fase. Carrega a página mais recente (50, mais antigas no topo);
 * "Carregar mensagens anteriores" busca a página anterior e preserva a posição de rolagem.
 *
 * Acessibilidade: a lista é `role="log"` (focável para rolar por teclado) e cada balão é um
 * `article` rotulado "Cliente, 14:32" / "Bot, 14:32" — o lado (esquerda/direita) nunca é a única
 * pista de quem falou. Cores do balão usam os tokens `--wa-*` (valem dentro da tela, nos 3 temas).
 */
export function ContactConversation({
  tenantSlug,
  contactId,
  contactName,
  timezone,
}: {
  tenantSlug: string;
  contactId: string;
  contactName: string;
  timezone: string;
}) {
  const [items, setItems] = useState<ConversationMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ao carregar páginas antigas: guarda a altura antes para manter o que o usuário estava lendo.
  const restoreScrollFromRef = useRef<number | null>(null);
  const scrollToBottomRef = useRef(false);

  const loadFirst = useCallback(async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const result = await getConversationAction({ tenantSlug, contactId });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        setStatus("error");
        return;
      }
      scrollToBottomRef.current = true;
      setItems(mergeConversation([], result.data.items));
      setNextCursor(result.data.nextCursor);
      setStatus("ready");
    } catch {
      setErrorMessage("Não deu para carregar a conversa agora.");
      setStatus("error");
    }
  }, [tenantSlug, contactId]);

  useEffect(() => {
    // `setTimeout 0`: evita setState síncrono dentro do efeito (regra react-hooks/set-state-in-effect).
    const timer = setTimeout(() => void loadFirst(), 0);
    return () => clearTimeout(timer);
  }, [loadFirst]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const result = await getConversationAction({ tenantSlug, contactId, cursor: nextCursor });
      if (!result.ok) {
        setMoreError(result.error.message);
        return;
      }
      restoreScrollFromRef.current = scrollRef.current?.scrollHeight ?? null;
      setItems((current) => mergeConversation(current, result.data.items));
      setNextCursor(result.data.nextCursor);
    } catch {
      setMoreError("Não deu para carregar as mensagens anteriores.");
    } finally {
      setLoadingMore(false);
    }
  }

  // Depois de pintar: 1ª carga desce até a mensagem mais recente; página antiga mantém a posição.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (scrollToBottomRef.current) {
      scrollToBottomRef.current = false;
      el.scrollTop = el.scrollHeight;
    } else if (restoreScrollFromRef.current !== null) {
      el.scrollTop += el.scrollHeight - restoreScrollFromRef.current;
      restoreScrollFromRef.current = null;
    }
  }, [items]);

  const days = useMemo(() => groupConversationByDay(items, timezone), [items, timezone]);
  const multipleNumbers = useMemo(() => new Set(items.map((m) => m.instanceLabel).filter(Boolean)).size > 1, [items]);

  return (
    <div className="flex flex-col gap-2" data-testid="contact-conversation">
      <div style={WA_TOKENS} className="relative overflow-hidden rounded-card border border-border bg-[var(--wa-bg)]">
        <ChatDoodle />
        <div
          ref={scrollRef}
          role="log"
          aria-label={`Conversa com ${contactName}`}
          aria-busy={status === "loading"}
          tabIndex={0}
          className="relative h-[min(26rem,52dvh)] overflow-y-auto overscroll-contain px-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
        >
          {status === "loading" ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <Skeleton className="h-10 w-3/5 rounded-lg" />
              <Skeleton className="ml-auto h-14 w-2/3 rounded-lg" />
              <Skeleton className="h-8 w-2/5 rounded-lg" />
              <Skeleton className="ml-auto h-10 w-1/2 rounded-lg" />
            </div>
          ) : status === "error" ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="rounded-card bg-white/90 px-3 py-2 text-sm text-[#111B21]">{errorMessage ?? "Não deu para carregar a conversa."}</p>
              <Button type="button" variant="secondary" icon={RefreshCw} onClick={() => void loadFirst()}>
                Tentar de novo
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#54656F]">
                <MessageCircle className="h-6 w-6" />
              </span>
              <p className="rounded-card bg-white/90 px-3 py-1.5 text-sm font-medium text-[#111B21]">
                Nenhuma mensagem nos últimos 90 dias
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {nextCursor ? (
                <div className="flex flex-col items-center gap-1 pb-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={loadingMore ? undefined : RefreshCw}
                    onClick={() => void loadMore()}
                    isLoading={loadingMore}
                    loadingText="Carregando…"
                  >
                    Carregar mensagens anteriores
                  </Button>
                  {moreError ? (
                    <p role="alert" className="rounded-md bg-white/90 px-2 py-1 text-xs text-danger">
                      {moreError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {days.map((day) => (
                <section key={day.key} aria-label={day.label} className="flex flex-col gap-1.5">
                  <h4 className="mx-auto my-1 rounded-md bg-white/90 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#54656F] shadow-[0_1px_0.5px_rgb(11_20_26/0.1)]">
                    {day.label}
                  </h4>
                  {day.items.map((message) => (
                    <Bubble key={message.id} message={message} timezone={timezone} showNumber={multipleNumbers} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
        {loadingMore ? (
          <span className="sr-only" role="status">
            <Loader2 aria-hidden="true" />
            Carregando mensagens anteriores
          </span>
        ) : null}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-text-secondary">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Histórico guardado por 90 dias (LGPD). Somente leitura.
      </p>
    </div>
  );
}

function Bubble({ message, timezone, showNumber }: { message: ConversationMessage; timezone: string; showNumber: boolean }) {
  const outbound = message.direction === "OUTBOUND";
  const time = formatTimeLabel(message.createdAt, timezone);
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        role="article"
        aria-label={bubbleAriaLabel(message.direction, time)}
        className={cn(
          "max-w-[85%] rounded-lg px-2.5 py-1.5 text-sm leading-snug text-[var(--wa-ink)] shadow-[0_1px_0.5px_rgb(11_20_26/0.13)]",
          outbound ? "rounded-tr-none bg-[var(--wa-out)]" : "rounded-tl-none bg-[var(--wa-in)]",
        )}
      >
        {showNumber && outbound && message.instanceLabel ? <p className="mb-0.5 text-[11px] font-semibold text-[#54656F]">{message.instanceLabel}</p> : null}
        <div className="flex flex-wrap items-end justify-end gap-x-2">
          {message.body.trim() ? (
            <p className="min-w-0 whitespace-pre-wrap break-words">{message.body}</p>
          ) : (
            <p className="italic text-[#54656F]">Mensagem sem texto</p>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1 pt-0.5 text-[11px] text-[#54656F]">
            <span className="tabular-nums" aria-hidden="true">
              {time}
            </span>
            {outbound ? <CheckCheck className="h-3.5 w-3.5 text-[var(--wa-tick)]" strokeWidth={2.4} aria-hidden="true" /> : null}
          </span>
        </div>
      </div>
    </div>
  );
}
