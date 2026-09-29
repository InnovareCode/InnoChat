"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { inviteTeamMemberAction } from "@/modules/signup/actions";

export type MemberRow = {
  id: string;
  email: string;
  role: "OWNER" | "STAFF";
  verified: boolean;
  isCurrentUser: boolean;
};

export function EquipeClient({
  tenantSlug,
  initialMembers,
  canInvite,
}: {
  tenantSlug: string;
  initialMembers: MemberRow[];
  canInvite: boolean;
}) {
  const { notify } = useToast();
  const [members] = useState<MemberRow[]>(initialMembers);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "STAFF">("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openInvite() {
    setEmail("");
    setRole("STAFF");
    setError(null);
    setDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }
    startTransition(async () => {
      const result = await inviteTeamMemberAction(tenantSlug, { email: email.trim(), role });
      if (!result.ok) {
        setError(
          result.error.code === "ALREADY_MEMBER"
            ? "Esta pessoa já faz parte da equipe."
            : result.error.message,
        );
        return;
      }
      notify({ variant: "success", title: "Convite enviado.", description: `Enviamos um link de convite para ${email.trim()}.` });
      setDialogOpen(false);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {canInvite ? (
          <Button onClick={openInvite}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Convidar membro
          </Button>
        ) : null}
      </div>

      {!canInvite ? (
        <Alert variant="info">Só o dono da empresa pode convidar novos membros.</Alert>
      ) : null}

      <Card className="rounded-hero">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>E-mail</TableHeadCell>
              <TableHeadCell>Papel</TableHeadCell>
              <TableHeadCell>E-mail confirmado</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <Avatar id={member.id} name={member.email} size="sm" />
                    <span>
                      {member.email}
                      {member.isCurrentUser ? <span className="ml-2 text-xs text-text-secondary">(você)</span> : null}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={member.role === "OWNER" ? "primary" : "neutral"}>
                    {member.role === "OWNER" ? "Dono" : "Equipe"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={member.verified ? "success" : "warning"}>{member.verified ? "Sim" : "Pendente"}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>Enviamos um link por e-mail para essa pessoa definir a senha e entrar.</DialogDescription>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            {error ? <Alert variant="danger">{error}</Alert> : null}
            <Field label="E-mail" required>
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  invalid={!!error}
                />
              )}
            </Field>
            <div>
              <Label htmlFor="invite-role">Papel</Label>
              <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as "OWNER" | "STAFF")}>
                <option value="STAFF">Equipe</option>
                <option value="OWNER">Dono</option>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={isPending} loadingText="Enviando…">
                Enviar convite
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
