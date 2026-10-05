import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

type Workshop = { id: string; name: string; active: boolean };

/** Cadastro das oficinas/locais usados na lista de seleção dos formulários. */
export function WorkshopsPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<Workshop[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error: failure } = await supabase.from("workshops").select("id, name, active").order("name");
    if (failure) setError(failure.message); else setRows(data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setError("");
    try {
      const result = await action();
      if (result.error) { setError(result.error.message.includes("workshops_name_unique") ? "Já existe uma oficina com esse nome." : result.error.message); return; }
      await load(); await onChanged();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  async function add(event: React.FormEvent) {
    event.preventDefault();
    const value = name.trim().replace(/\s+/g, " ");
    if (!value) { setError("Informe o nome da oficina."); return; }
    if (rows.some((row) => normalizeText(row.name) === normalizeText(value))) { setError("Já existe uma oficina com esse nome."); return; }
    await run(() => supabase.from("workshops").insert({ name: value }));
    setName("");
  }
  async function remove(row: Workshop) {
    const { count, error: failure } = await supabase.from("appointments").select("id", { count: "exact", head: true }).eq("workshop", row.name);
    if (failure) { setError(failure.message); return; }
    if (count) { setError(`${count} agendamento(s) usam “${row.name}”. Desative a oficina em vez de removê-la.`); return; }
    await run(() => supabase.from("workshops").delete().eq("id", row.id));
  }

  return <section className="space-y-3">
    <h3 className="font-semibold">Oficinas / locais</h3>
    <p className="text-xs text-muted-foreground">Estes nomes aparecem na lista do campo Local/Oficina. Desativar esconde da lista sem alterar agendamentos existentes.</p>
    <form onSubmit={add} className="flex flex-wrap items-end gap-2">
      <label className="min-w-48 flex-1 text-sm">Nova oficina<Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></label>
      <Button type="submit" disabled={busy}>Adicionar</Button>
    </form>
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    {rows.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm">
      <span className={`min-w-0 flex-1 font-medium ${row.active ? "" : "text-muted-foreground line-through"}`}>{row.name}</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => supabase.from("workshops").update({ active: !row.active }).eq("id", row.id))}>{row.active ? "Desativar" : "Ativar"}</Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove(row)}>Remover</Button>
    </div>)}
    {!rows.length && <p className="text-sm text-muted-foreground">Nenhuma oficina cadastrada.</p>}
  </section>;
}
