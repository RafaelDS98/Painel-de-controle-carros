import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dash, formatDateBR, formatDateTimeBR } from "@/lib/agenda-safety";

type TrashRow = { id: string; plate: string; date: string | null; store: string; archived_at: string | null; archived_by: string | null };

/** Lixeira (só master): agendamentos arquivados com opção de restaurar. */
export function TrashDialog({ open, onOpenChange, onRestored }: { open: boolean; onOpenChange: (open: boolean) => void; onRestored: () => void }) {
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setError("");
    const { data, error: loadError } = await supabase.from("appointments").select("id, plate, date, store, archived_at, archived_by")
      .not("archived_at", "is", null).order("archived_at", { ascending: false }).limit(500);
    if (loadError) { setError(`Não foi possível carregar a Lixeira: ${loadError.message}`); return; }
    const list = data ?? [];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.archived_by).filter((id): id is string => Boolean(id)))];
    if (ids.length) {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setNames(Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name ?? ""])));
    }
  }

  useEffect(() => { if (open) void load(); }, [open]);

  async function restore(id: string) {
    setBusy(id);
    const { error: restoreError } = await supabase.from("appointments").update({ archived_at: null }).eq("id", id);
    setBusy(null);
    if (restoreError) { toast.error(`Não foi possível restaurar: ${restoreError.message}`); return; }
    toast.success("Agendamento restaurado para a agenda.");
    setRows((current) => current.filter((r) => r.id !== id));
    onRestored();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lixeira</DialogTitle>
          <DialogDescription>Agendamentos excluídos. Eles não aparecem na agenda, nos indicadores nem na exportação até serem restaurados.</DialogDescription>
        </DialogHeader>
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {!error && rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">A Lixeira está vazia.</p>}
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="text-sm">
                <p className="font-semibold">{dash(row.plate)} • {formatDateBR(row.date)} • {dash(row.store)}</p>
                <p className="text-xs text-muted-foreground">Excluído por {dash(row.archived_by ? names[row.archived_by] : "")} em {formatDateTimeBR(row.archived_at)}</p>
              </div>
              <Button variant="outline" size="sm" disabled={busy === row.id} onClick={() => void restore(row.id)}>Restaurar</Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
