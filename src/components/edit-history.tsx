import { formatDateTimeBR } from "@/lib/agenda-safety";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { authorLabel } from "@/lib/normalize";

export const fieldLabels: Record<string, string> = {
  status: "Situação", date: "Data de atendimento", time: "Hora", plate: "Placa", store: "Loja", model: "Modelo",
  contact: "Contato", workshop: "Local/Oficina", issue: "Problema relatado", note: "Observação", operator: "Operador",
  external_order: "O.S Externa", original_deadline: "Previsão original", current_deadline: "Previsão atual",
  priority_urgent: "Urgente", rework_of: "Retrabalho de", rework_reason: "Motivo do retrabalho", sgloc_reference: "ID SGLOC",
  store_id: "Loja (código)", brand: "Marca", contact_number: "Telefone do contato", operator_id: "Operador (código)",
  schedule_type: "Tipo", os_number: "O.S Fornecedor", supplier_id: "Fornecedor (código)", km_scheduled: "KM do agendamento",
  client_id: "Cliente (código)", forwarded_workshop: "Encaminhado para oficina", sgloc_performed: "Realizado no SGLOC", sgloc_confirmed: "Confirmado no SGLOC",
};

export type LogRow = {
  id: string; changed_by: string | null; field_changed: string; old_value: string | null; new_value: string | null; changed_at: string;
  profiles: { full_name: string | null } | null; appointments: { plate: string } | null;
};

const show = (value: string | null) => (value === null || value.trim() === "" ? "—" : value);
export const logSelect = "id, changed_by, field_changed, old_value, new_value, changed_at, profiles(full_name), appointments(plate)";

export function LogLine({ row, withPlate, onPlateClick }: { row: LogRow; withPlate?: boolean; onPlateClick?: ((plate: string) => void) | undefined }) {
  return (
    <li className="rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{authorLabel(row.changed_by, row.profiles?.full_name)} • {formatDateTimeBR(row.changed_at)}</span>
        {withPlate && <Button variant="link" className="min-h-11 h-auto gap-1 px-2 font-semibold text-primary" onClick={() => onPlateClick?.(row.appointments?.plate || "")} title="Histórico do veículo">{row.appointments?.plate || "Não informado"}<ArrowRight className="size-4" /></Button>}
      </div>
      <p className="mt-1"><span className="font-semibold">{fieldLabels[row.field_changed] ?? row.field_changed}:</span>{" "}
        <span className="text-muted-foreground line-through">{show(row.old_value)}</span> → <span className="font-medium">{show(row.new_value)}</span></p>
    </li>
  );
}

export function AppointmentHistory({ appointmentId, refreshKey, customLabels = {} }: { appointmentId: string; refreshKey: number; customLabels?: Record<string, string> }) {
  const [rows, setRows] = useState<LogRow[] | null>(null);
  useEffect(() => {
    let active = true;
    supabase.from("edit_log").select(logSelect).eq("appointment_id", appointmentId).order("changed_at", { ascending: false })
      .then(({ data }) => { if (active) setRows((data ?? []) as unknown as LogRow[]); });
    return () => { active = false; };
  }, [appointmentId, refreshKey]);
  return (
    <section className="border-t pt-4">
      <h3 className="mb-3 text-sm font-semibold">Histórico de alterações</h3>
      {rows === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        : <ul className="space-y-2">{rows.map((row) => <LogLine key={row.id} row={{ ...row, field_changed: customLabels[row.field_changed] ?? row.field_changed }} />)}</ul>}
    </section>
  );
}
