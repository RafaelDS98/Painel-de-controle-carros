import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const fieldLabels: Record<string, string> = {
  status: "Situação", date: "Data de atendimento", time: "Hora", plate: "Placa", store: "Loja", model: "Modelo",
  contact: "Contato", workshop: "Local/Oficina", issue: "Problema relatado", note: "Observação", operator: "Operador",
  external_order: "O.S Externa", original_deadline: "Previsão original", current_deadline: "Previsão atual",
  priority_urgent: "Urgente", rework_of: "Retrabalho de", rework_reason: "Motivo do retrabalho", sgloc_reference: "Referência SGLOC",
};

type LogRow = {
  id: string; field_changed: string; old_value: string | null; new_value: string | null; changed_at: string;
  profiles: { full_name: string | null } | null; appointments: { plate: string } | null;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const show = (value: string | null) => (value === null || value === "" ? "vazio" : value);
const select = "id, field_changed, old_value, new_value, changed_at, profiles(full_name), appointments(plate)";

function LogLine({ row, withPlate }: { row: LogRow; withPlate?: boolean }) {
  return (
    <li className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{row.profiles?.full_name || "Usuário sem nome"} • {dateTime.format(new Date(row.changed_at))}</span>
        {withPlate && <span className="rounded bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground">{row.appointments?.plate || "—"}</span>}
      </div>
      <p className="mt-1"><span className="font-semibold">{fieldLabels[row.field_changed] ?? row.field_changed}:</span>{" "}
        <span className="text-muted-foreground line-through">{show(row.old_value)}</span> → <span className="font-medium">{show(row.new_value)}</span></p>
    </li>
  );
}

export function AppointmentHistory({ appointmentId, refreshKey }: { appointmentId: string; refreshKey: number }) {
  const [rows, setRows] = useState<LogRow[] | null>(null);
  useEffect(() => {
    let active = true;
    supabase.from("edit_log").select(select).eq("appointment_id", appointmentId).order("changed_at", { ascending: false })
      .then(({ data }) => { if (active) setRows((data ?? []) as unknown as LogRow[]); });
    return () => { active = false; };
  }, [appointmentId, refreshKey]);
  return (
    <section className="border-t pt-4">
      <h3 className="mb-3 text-sm font-semibold">Histórico de alterações</h3>
      {rows === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        : <ul className="space-y-2">{rows.map((row) => <LogLine key={row.id} row={row} />)}</ul>}
    </section>
  );
}

export function ChangeLogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pageSize = 20;
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    if (!open) return;
    supabase.from("edit_log").select(select, { count: "exact" }).order("changed_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)
      .then(({ data, count }) => { setRows((data ?? []) as unknown as LogRow[]); setTotal(count ?? 0); });
  }, [open, page]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Log de alterações</DialogTitle><DialogDescription>Todas as alterações de agendamentos, mais recentes primeiro.</DialogDescription></DialogHeader>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
          : <ul className="space-y-2">{rows.map((row) => <LogLine key={row.id} row={row} withPlate />)}</ul>}
        <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
          <span>{total} alteração(ões) • página {page} de {pages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ArrowLeft /></Button>
            <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página"><ArrowRight /></Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
