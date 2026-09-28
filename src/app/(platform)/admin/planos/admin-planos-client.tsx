"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { updatePlanAction } from "@/modules/billing/admin-actions";

export type PlanRow = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  maxWhatsappNumbers: number;
  maxProfessionals: number | null;
  active: boolean;
  sortOrder: number;
};

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type FormState = {
  name: string;
  priceReais: string;
  maxWhatsappNumbers: string;
  maxProfessionalsUnlimited: boolean;
  maxProfessionals: string;
  active: boolean;
  sortOrder: string;
};

function toForm(plan: PlanRow): FormState {
  return {
    name: plan.name,
    priceReais: (plan.priceCents / 100).toFixed(2),
    maxWhatsappNumbers: String(plan.maxWhatsappNumbers),
    maxProfessionalsUnlimited: plan.maxProfessionals === null,
    maxProfessionals: plan.maxProfessionals !== null ? String(plan.maxProfessionals) : "",
    active: plan.active,
    sortOrder: String(plan.sortOrder),
  };
}

export function AdminPlanosClient({ initialPlans }: { initialPlans: PlanRow[] }) {
  const { notify } = useToast();
  const [plans, setPlans] = useState<PlanRow[]>([...initialPlans].sort((a, b) => a.sortOrder - b.sortOrder));
  const [editing, setEditing] = useState<PlanRow | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openEdit(plan: PlanRow) {
    setEditing(plan);
    setForm(toForm(plan));
    setFormError(null);
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !form) return;
    setFormError(null);

    const priceCents = Math.round(Number(form.priceReais.replace(",", ".")) * 100);
    if (Number.isNaN(priceCents) || priceCents < 0) {
      setFormError("Informe um preço válido.");
      return;
    }

    startTransition(async () => {
      const result = await updatePlanAction(editing.id, {
        name: form.name.trim(),
        priceCents,
        maxWhatsappNumbers: Number(form.maxWhatsappNumbers) || 1,
        maxProfessionals: form.maxProfessionalsUnlimited ? null : Number(form.maxProfessionals) || 1,
        active: form.active,
        sortOrder: Number(form.sortOrder) || 0,
      });

      if (!result.ok) {
        setFormError(result.error.message);
        return;
      }

      const saved = result.data as PlanRow;
      setPlans((prev) => prev.map((p) => (p.id === saved.id ? saved : p)).sort((a, b) => a.sortOrder - b.sortOrder));
      setEditing(null);
      setForm(null);
      notify({ variant: "success", title: "Plano atualizado." });
    });
  }

  const hasUndefinedPrice = plans.some((p) => p.priceCents === 0);

  return (
    <div>
      <PageHeader title="Planos" description="Limites, preço e ativação de cada plano." />

      {hasUndefinedPrice ? (
        <Alert variant="warning" title="Preço ainda não definido" className="mb-4">
          Planos com preço R$ 0,00 e inativos continuam permitindo o teste gratuito normalmente — eles só não podem ser
          vendidos até você definir um preço e ativá-los.
        </Alert>
      ) : null}

      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Plano</TableHeadCell>
              <TableHeadCell>Preço</TableHeadCell>
              <TableHeadCell>Números de WhatsApp</TableHeadCell>
              <TableHeadCell>Profissionais</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell className="text-right">Ações</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>
                  {plan.priceCents > 0 ? formatBRL(plan.priceCents) : <span className="text-text-secondary">A definir</span>}
                </TableCell>
                <TableCell>{plan.maxWhatsappNumbers}</TableCell>
                <TableCell>{plan.maxProfessionals === null ? "Ilimitado" : plan.maxProfessionals}</TableCell>
                <TableCell>
                  <Badge variant={plan.active ? "success" : "neutral"}>{plan.active ? "Ativo" : "Inativo"}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label={`Editar ${plan.name}`} onClick={() => openEdit(plan)}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogTitle>Editar plano</DialogTitle>
          <DialogDescription>Alterações valem para novas cobranças a partir de agora.</DialogDescription>
          {form ? (
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
              {formError ? <Alert variant="danger">{formError}</Alert> : null}

              <Field label="Nome" required>
                {(fieldProps) => (
                  <Input {...fieldProps} value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} required maxLength={80} />
                )}
              </Field>

              <Field label="Preço mensal (R$)" required hint="R$ 0,00 mantém o plano fora de venda, mas não afeta o teste.">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    inputMode="decimal"
                    value={form.priceReais}
                    onChange={(e) => setForm((f) => f && { ...f, priceReais: e.target.value })}
                    required
                  />
                )}
              </Field>

              <Field label="Limite de números de WhatsApp" required>
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="number"
                    min={1}
                    value={form.maxWhatsappNumbers}
                    onChange={(e) => setForm((f) => f && { ...f, maxWhatsappNumbers: e.target.value })}
                    required
                  />
                )}
              </Field>

              <div>
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={form.maxProfessionalsUnlimited}
                    onChange={(e) => setForm((f) => f && { ...f, maxProfessionalsUnlimited: e.target.checked })}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  Profissionais ilimitados
                </label>
                {!form.maxProfessionalsUnlimited ? (
                  <div className="mt-3">
                    <Field label="Limite de profissionais" required>
                      {(fieldProps) => (
                        <Input
                          {...fieldProps}
                          type="number"
                          min={1}
                          value={form.maxProfessionals}
                          onChange={(e) => setForm((f) => f && { ...f, maxProfessionals: e.target.value })}
                          required
                        />
                      )}
                    </Field>
                  </div>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm text-text">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => f && { ...f, active: e.target.checked })}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Ativo (pode ser vendido/exibido para novas empresas)
              </label>

              <Field label="Ordem de exibição">
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => f && { ...f, sortOrder: e.target.value })}
                  />
                )}
              </Field>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={closeEdit}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
