"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Plus, Search, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/lib/cn";
import { formatPhoneDisplay } from "@/components/lib/format-phone";
import { formatDateTimeShortLabel } from "@/components/lib/format-date";
import { listContactsAction, exportContactsCsvAction } from "@/modules/contacts/actions";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { ContactDetailDialog } from "@/components/contacts/contact-detail-dialog";
import type { ProfessionalRow } from "../profissionais/profissionais-client";
import type { ServiceRow } from "../servicos/servicos-client";

export type ContactSource = "WHATSAPP" | "PANEL";

export type ContactListItem = {
  id: string;
  displayName: string;
  name: string | null;
  pushName: string | null;
  phoneE164: string | null;
  source: ContactSource;
  appointmentsCount: number;
  noShowCount: number;
  lastAppointmentAt: string | null;
  nextAppointmentAt: string | null;
  botPaused: boolean;
  createdAt: string;
};

export type ContactFilter = "all" | "upcoming" | "botPaused" | "inactive90d";

const FILTER_CHIPS: { value: ContactFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "upcoming", label: "Com agendamento futuro" },
  { value: "botPaused", label: "Bot pausado" },
  { value: "inactive90d", label: "Sem vir há 90 dias" },
];

const WRITE_BLOCKED_HINT = "Assinatura suspensa — ação bloqueada até o pagamento.";

function SourceBadge({ source }: { source: ContactSource }) {
  return (
    <Badge variant={source === "WHATSAPP" ? "success" : "neutral"}>
      {source === "WHATSAPP" ? "WhatsApp" : "Painel"}
    </Badge>
  );
}

export function ClientesClient({
  tenantSlug,
  timezone,
  isOwner,
  writeBlocked,
  initialContacts,
  initialNextCursor,
  initialLoadError,
  professionals,
  services,
}: {
  tenantSlug: string;
  timezone: string;
  isOwner: boolean;
  writeBlocked: boolean;
  initialContacts: ContactListItem[];
  initialNextCursor: string | null;
  initialLoadError: string | null;
  professionals: ProfessionalRow[];
  services: ServiceRow[];
}) {
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [contacts, setContacts] = useState<ContactListItem[]>(initialContacts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(initialLoadError);
  const [exporting, setExporting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Paleta de comando (Ctrl+K) e o atalho "Novo cliente" do Início linkam para
  // `/clientes?novo=1` — abre o diálogo direto. `setTimeout(fn, 0)`: setState direto no corpo do
  // efeito dispara o lint `react-hooks/set-state-in-effect` (armadilha já registrada na memória).
  useEffect(() => {
    if (searchParams.get("novo") !== "1") return;
    const id = setTimeout(() => {
      setCreateOpen(true);
      router.replace(`/${tenantSlug}/clientes`, { scroll: false });
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Debounce da busca — só depois de o usuário parar de digitar por 350ms é que ela
  // dispara uma nova consulta (evita uma requisição por tecla).
  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timeoutId);
  }, [search]);

  const load = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    listContactsAction(tenantSlug, { q: debouncedSearch || undefined, filter, limit: 20 })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        if (!result.ok) {
          setError(result.error.message);
          setContacts([]);
          setNextCursor(null);
          return;
        }
        setContacts(result.data.items as ContactListItem[]);
        setNextCursor(result.data.nextCursor);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [tenantSlug, debouncedSearch, filter]);

  useEffect(() => {
    const timeoutId = setTimeout(load, 0);
    return () => clearTimeout(timeoutId);
  }, [load]);

  function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    listContactsAction(tenantSlug, { q: debouncedSearch || undefined, filter, cursor: nextCursor, limit: 20 })
      .then((result) => {
        if (!result.ok) {
          notify({ variant: "error", title: "Não foi possível carregar mais clientes", description: result.error.message });
          return;
        }
        setContacts((prev) => [...prev, ...(result.data.items as ContactListItem[])]);
        setNextCursor(result.data.nextCursor);
      })
      .finally(() => setLoadingMore(false));
  }

  function handleExport() {
    setExporting(true);
    exportContactsCsvAction(tenantSlug)
      .then((result) => {
        if (!result.ok) {
          notify({ variant: "error", title: "Não foi possível exportar", description: result.error.message });
          return;
        }
        const blob = new Blob([result.data.csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .finally(() => setExporting(false));
  }

  function handleCreated(contactId: string) {
    load();
    setDetailId(contactId);
    notify({ variant: "success", title: "Cliente cadastrado." });
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Lista, agendamentos e pausa do bot por cliente."
        action={
          <div className="flex flex-wrap gap-2">
            {isOwner ? (
              <Button variant="secondary" onClick={handleExport} isLoading={exporting}>
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar CSV
              </Button>
            ) : null}
            <Button
              onClick={() => setCreateOpen(true)}
              disabled={writeBlocked}
              title={writeBlocked ? WRITE_BLOCKED_HINT : undefined}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo cliente
            </Button>
          </div>
        }
      />

      {writeBlocked ? (
        <Alert variant="danger" className="mb-4">
          {WRITE_BLOCKED_HINT}{" "}
          <Link href={`/${tenantSlug}/assinatura`} className="font-medium underline">
            Ver assinatura
          </Link>
        </Alert>
      ) : null}

      <Card className="mb-4 flex flex-col gap-3 p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
          <Input
            aria-label="Buscar cliente por nome ou telefone"
            placeholder="Buscar por nome ou telefone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar clientes">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              aria-pressed={filter === chip.value}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                filter === chip.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-text-secondary hover:bg-bg",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </Card>

      {loading ? (
        <Card className="p-12 text-center text-sm text-text-secondary">Carregando clientes…</Card>
      ) : error ? (
        <EmptyState icon={Users} title="Não deu para carregar" description={error} />
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={debouncedSearch || filter !== "all" ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
          description={
            debouncedSearch || filter !== "all"
              ? "Ajuste a busca ou os filtros."
              : "Seus clientes aparecem aqui quando agendam pelo WhatsApp ou quando você cadastra."
          }
          action={
            !debouncedSearch && filter === "all" ? (
              <Button onClick={() => setCreateOpen(true)} disabled={writeBlocked}>
                Novo cliente
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card className="hidden md:block">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeadCell>Cliente</TableHeadCell>
                  <TableHeadCell>Telefone</TableHeadCell>
                  <TableHeadCell>Agendamentos</TableHeadCell>
                  <TableHeadCell>Faltas</TableHeadCell>
                  <TableHeadCell>Último</TableHeadCell>
                  <TableHeadCell>Próximo</TableHeadCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id} className="cursor-pointer" onClick={() => setDetailId(contact.id)}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{contact.displayName}</span>
                        <SourceBadge source={contact.source} />
                        {contact.botPaused ? <Badge variant="warning">Bot pausado</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{contact.phoneE164 ? formatPhoneDisplay(contact.phoneE164) : "—"}</TableCell>
                    <TableCell>{contact.appointmentsCount}</TableCell>
                    <TableCell>{contact.noShowCount}</TableCell>
                    <TableCell>
                      {contact.lastAppointmentAt ? formatDateTimeShortLabel(contact.lastAppointmentAt, timezone) : "—"}
                    </TableCell>
                    <TableCell>
                      {contact.nextAppointmentAt ? formatDateTimeShortLabel(contact.nextAppointmentAt, timezone) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex flex-col gap-3 md:hidden">
            {contacts.map((contact) => (
              <Card
                key={contact.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailId(contact.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailId(contact.id);
                  }
                }}
                className="cursor-pointer p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-text">{contact.displayName}</p>
                  <SourceBadge source={contact.source} />
                  {contact.botPaused ? <Badge variant="warning">Bot pausado</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-text-secondary">
                  {contact.phoneE164 ? formatPhoneDisplay(contact.phoneE164) : "Sem telefone"}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span>{contact.appointmentsCount} agendamento(s)</span>
                  <span>{contact.noShowCount} falta(s)</span>
                  {contact.nextAppointmentAt ? (
                    <span>Próximo: {formatDateTimeShortLabel(contact.nextAppointmentAt, timezone)}</span>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>

          {nextCursor ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={loadMore} isLoading={loadingMore}>
                Carregar mais
              </Button>
            </div>
          ) : null}
        </>
      )}

      <ContactFormDialog
        tenantSlug={tenantSlug}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={handleCreated}
        onOpenExisting={(contactId) => setDetailId(contactId)}
      />

      <ContactDetailDialog
        tenantSlug={tenantSlug}
        timezone={timezone}
        isOwner={isOwner}
        writeBlocked={writeBlocked}
        contactId={detailId}
        professionals={professionals}
        services={services}
        onOpenChange={(open) => !open && setDetailId(null)}
        onChanged={load}
      />
    </div>
  );
}
