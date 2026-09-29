"use client";

import { useMemo, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCheck, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { navIconFor } from "@/components/shell/nav-items";
import { STAGGER_DELAY_S } from "@/components/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { BOT_TEXT_VARIABLES, DEFAULT_BOT_TEXTS, renderTemplate, type BotTextKeyLiteral } from "@/core/bot/texts";
import { resetBotTextAction, upsertBotTextAction } from "@/modules/bot-texts/bot-text-actions";

export type BotTextRow = { key: BotTextKeyLiteral; text: string; isDefault: boolean };

type GroupDef = { label: string; keys: BotTextKeyLiteral[] };

const GROUPS: GroupDef[] = [
  { label: "Saudação e menu", keys: ["GREETING", "MAIN_MENU"] },
  {
    label: "Agendamento",
    keys: [
      "CHOOSE_SERVICE",
      "CHOOSE_PROFESSIONAL",
      "CHOOSE_DAY",
      "CHOOSE_TIME",
      "NO_SLOTS_DAY",
      "NO_AVAILABILITY",
      "ASK_NAME",
      "CONFIRM_SUMMARY",
      "BOOKED",
      "SLOT_TAKEN",
    ],
  },
  {
    label: "Meus agendamentos",
    keys: ["MY_APPOINTMENTS", "NO_APPOINTMENTS", "APPOINTMENT_ACTIONS", "CONFIRM_CANCEL", "CANCELED", "RESCHEDULED", "TOO_LATE"],
  },
  { label: "Atendimento humano", keys: ["HUMAN_HANDOFF"] },
  { label: "Erros e sessão", keys: ["INVALID_OPTION", "TOO_MANY_INVALID", "ONLY_TEXT", "SESSION_EXPIRED"] },
  { label: "Despedida", keys: ["GOODBYE"] },
  {
    label: "Rótulos do menu",
    keys: [
      "LABEL_CONFIRM",
      "LABEL_OTHER_TIME",
      "LABEL_CANCEL_YES",
      "LABEL_CANCEL_NO",
      "LABEL_MORE_DAYS",
      "LABEL_MORE_TIMES",
      "LABEL_MORE",
      "LABEL_BACK_TO_MENU",
    ],
  },
];

const KEY_DESCRIPTION: Record<BotTextKeyLiteral, string> = {
  GREETING: "Primeira mensagem, quando o cliente inicia a conversa.",
  MAIN_MENU: "Menu principal com as opções disponíveis.",
  CHOOSE_SERVICE: "Pergunta qual serviço o cliente quer agendar.",
  CHOOSE_PROFESSIONAL: "Pergunta com qual profissional o cliente prefere ser atendido.",
  CHOOSE_DAY: "Pergunta em qual dia o cliente quer agendar.",
  CHOOSE_TIME: "Lista os horários disponíveis no dia escolhido.",
  NO_SLOTS_DAY: "Avisa que não há horário livre no dia escolhido.",
  NO_AVAILABILITY: "Avisa que não há nenhum horário disponível no momento.",
  ASK_NAME: "Pede o nome do cliente antes de continuar.",
  CONFIRM_SUMMARY: "Resumo do agendamento para o cliente confirmar.",
  BOOKED: "Confirma que o agendamento foi feito com sucesso.",
  SLOT_TAKEN: "Avisa que o horário escolhido acabou de ser ocupado por outra pessoa.",
  MY_APPOINTMENTS: "Lista os agendamentos do cliente.",
  NO_APPOINTMENTS: "Avisa que o cliente não tem agendamentos marcados.",
  APPOINTMENT_ACTIONS: "Pergunta o que o cliente quer fazer com o agendamento.",
  CONFIRM_CANCEL: "Pede confirmação antes de cancelar o agendamento.",
  CANCELED: "Confirma que o agendamento foi cancelado.",
  RESCHEDULED: "Confirma que o agendamento foi remarcado.",
  TOO_LATE: "Avisa que já está muito perto do horário para cancelar ou remarcar.",
  HUMAN_HANDOFF: "Avisa que um atendente humano vai continuar a conversa.",
  INVALID_OPTION: "Resposta quando o cliente envia uma opção que o bot não entende.",
  TOO_MANY_INVALID: "Quando o cliente erra a opção repetidas vezes e o bot chama um atendente.",
  ONLY_TEXT: "Quando o cliente envia algo que não é texto (áudio, imagem, figurinha...).",
  SESSION_EXPIRED: "Quando a conversa ficou parada por um tempo e o bot recomeça o menu.",
  GOODBYE: "Mensagem de despedida ao final da conversa.",
  LABEL_CONFIRM: "Botão/opção \"Confirmar\" na tela de confirmar agendamento.",
  LABEL_OTHER_TIME: "Botão/opção \"Escolher outro horário\" na tela de confirmar agendamento.",
  LABEL_CANCEL_YES: "Botão/opção \"Sim, cancelar\" na confirmação de cancelamento.",
  LABEL_CANCEL_NO: "Botão/opção \"Não, manter\" na confirmação de cancelamento.",
  LABEL_MORE_DAYS: "Opção de paginação \"Ver mais datas\" na lista de dias disponíveis.",
  LABEL_MORE_TIMES: "Opção de paginação \"Mais horários\" na lista de horários disponíveis.",
  LABEL_MORE: "Opção de paginação genérica \"Ver mais\" (menus com mais de 9 itens).",
  LABEL_BACK_TO_MENU: "Rodapé \"0. Menu principal\" que aparece nas telas do bot.",
};

const PREVIEW_SAMPLE_VARS: Record<(typeof BOT_TEXT_VARIABLES)[number], string> = {
  nome: "Maria",
  empresa: "Studio Bela",
  servico: "Corte feminino",
  profissional: "Ana",
  data: "Ter 30/09",
  hora: "14:30",
  preco: "R$ 80,00",
};

/** Prévia caprichada em balão de WhatsApp (docs/design/screens/premium/onda2): fundo com o
 * padrão de papel de parede sutil do WhatsApp Web, cabeçalho com nome do bot, e o balão com
 * "cauda", horário e duplo check — para o dono reconhecer de cara o que o cliente vai ver. */
function WhatsAppBubble({ text, tenantName }: { text: string; tenantName?: string }) {
  return (
    <div className="overflow-hidden rounded-hero border border-[#0b141a] bg-[#0b141a] shadow-card">
      <div className="flex items-center gap-2.5 bg-[#202c33] px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-xs font-semibold text-white">
          {(tenantName ?? "IC").slice(0, 2).toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-medium text-[#e9edef]">{tenantName ?? "Assistente"}</p>
          <p className="text-[11px] text-[#8696a0]">via WhatsApp Business</p>
        </div>
      </div>
      <div
        className="min-h-[120px] p-4 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:16px_16px]"
      >
        <div className="relative max-w-[85%] rounded-lg rounded-tl-none bg-[#202c33] px-3 py-2 text-sm text-[#e9edef] shadow-sm">
          <p className="whitespace-pre-wrap">{text || " "}</p>
          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#8696a0]">
            14:32
            <CheckCheck className="h-3 w-3 text-[#53bdeb]" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  );
}

export function MensagensBotClient({ tenantSlug, initialTexts }: { tenantSlug: string; initialTexts: BotTextRow[] }) {
  const { notify } = useToast();
  const reduceMotion = useReducedMotion();
  const [texts, setTexts] = useState<Map<BotTextKeyLiteral, BotTextRow>>(
    new Map(initialTexts.map((row) => [row.key, row])),
  );
  const [editingKey, setEditingKey] = useState<BotTextKeyLiteral | null>(null);
  const [confirmReset, setConfirmReset] = useState<BotTextKeyLiteral | null>(null);
  const [isPending, startTransition] = useTransition();

  const editingRow = editingKey ? texts.get(editingKey) ?? null : null;

  function handleSaveText(key: BotTextKeyLiteral, text: string) {
    startTransition(async () => {
      const result = await upsertBotTextAction(tenantSlug, { key, text });
      if (!result.ok) {
        notify({ variant: "error", title: "Não foi possível salvar", description: result.error.message });
        return;
      }
      setTexts((prev) => new Map(prev).set(key, { key, text, isDefault: false }));
      notify({ variant: "success", title: "Mensagem atualizada." });
      setEditingKey(null);
    });
  }

  function handleReset() {
    if (!confirmReset) return;
    const key = confirmReset;
    startTransition(async () => {
      const result = await resetBotTextAction(tenantSlug, key);
      if (!result.ok) {
        notify({ variant: "error", title: "Não foi possível restaurar", description: result.error.message });
        setConfirmReset(null);
        return;
      }
      setTexts((prev) => new Map(prev).set(key, { key, text: DEFAULT_BOT_TEXTS[key], isDefault: true }));
      notify({ variant: "success", title: "Mensagem restaurada ao padrão." });
      setConfirmReset(null);
    });
  }

  return (
    <div>
      <PageHeader icon={navIconFor("mensagens-bot")} title="Mensagens do bot" description="Edite os textos que o bot envia no WhatsApp, por etapa da conversa." />

      <div className="flex flex-col gap-6">
        {GROUPS.map((group, groupIndex) => (
          <motion.div
            key={group.label}
            initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: groupIndex * STAGGER_DELAY_S, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="rounded-hero transition-[border-color,box-shadow] duration-200 hover:border-primary/20 hover:shadow-card-hover">
              <CardHeader>
                <CardTitle>{group.label}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border p-0">
                {group.keys.map((key) => {
                  const row = texts.get(key);
                  if (!row) return null;
                  return (
                    <div key={key} className="flex items-center justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text">{KEY_DESCRIPTION[key]}</p>
                          <Badge variant={row.isDefault ? "neutral" : "primary"}>
                            {row.isDefault ? "Padrão" : "Personalizado"}
                          </Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-text-secondary">{row.text}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {!row.isDefault ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Restaurar padrão de ${KEY_DESCRIPTION[key]}`}
                            onClick={() => setConfirmReset(key)}
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        ) : null}
                        <Button variant="secondary" size="sm" onClick={() => setEditingKey(key)}>
                          Editar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {editingRow ? (
        <EditDialogController
          row={editingRow}
          isPending={isPending}
          onClose={() => setEditingKey(null)}
          onSave={(text) => handleSaveText(editingRow.key, text)}
        />
      ) : null}

      <Dialog open={!!confirmReset} onOpenChange={(open) => !open && setConfirmReset(null)}>
        <DialogContent>
          <DialogTitle>Restaurar padrão</DialogTitle>
          <DialogDescription>
            Isso substitui o texto personalizado pelo texto padrão do InnoChat para esta mensagem. Não pode ser desfeito.
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setConfirmReset(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={handleReset} isLoading={isPending} loadingText="Restaurando…">
              Restaurar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditDialogController({
  row,
  isPending,
  onClose,
  onSave,
}: {
  row: BotTextRow;
  isPending: boolean;
  onClose: () => void;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(row.text);
  const preview = useMemo(() => renderTemplate(text, PREVIEW_SAMPLE_VARS), [text]);

  function insertVariable(variable: string) {
    setText((prev) => `${prev}{${variable}}`);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>Editar mensagem</DialogTitle>
        <DialogDescription>{KEY_DESCRIPTION[row.key]}</DialogDescription>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor="bot-text-editor" className="mb-1.5 block text-sm font-medium text-text">
              Texto
            </label>
            <textarea
              id="bot-text-editor"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              maxLength={1000}
              className="w-full rounded-card border border-border bg-surface p-3 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            <p className="mt-1 text-xs text-text-secondary">{text.length}/1000</p>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-text">Variáveis disponíveis</p>
            <div className="flex flex-wrap gap-1.5">
              {BOT_TEXT_VARIABLES.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => insertVariable(variable)}
                  className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium text-text hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {`{${variable}}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-text">Prévia</p>
            <WhatsAppBubble text={preview} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" isLoading={isPending} onClick={() => onSave(text)} loadingText="Salvando…">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
