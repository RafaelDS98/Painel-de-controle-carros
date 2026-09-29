import { useEffect, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ContactRow = {
  id: string; contact_type: "ligação" | "mensagem"; contact_at: string; note: string | null;
  profiles: { full_name: string | null } | null;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
function localInputDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function ContactRegister({ appointmentId, userId }: { appointmentId: string; userId: string }) {
  const [rows, setRows] = useState<ContactRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"ligação" | "mensagem">("ligação");
  const [at, setAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const { data, error: readError } = await supabase.from("contact_log")
      .select("id, contact_type, contact_at, note, profiles(full_name)")
      .eq("appointment_id", appointmentId).order("contact_at", { ascending: false });
    if (readError) { setError("Não foi possível carregar os contatos."); return; }
    setRows((data ?? []) as ContactRow[]);
  }

  useEffect(() => { setRows(null); setOpen(false); setError(""); void load(); }, [appointmentId]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !at) return;
    const timestamp = new Date(`${at}:00-03:00`);
    if (Number.isNaN(timestamp.getTime())) { setError("Informe uma data e hora válidas."); return; }
    setSaving(true); setError("");
    const { error: writeError } = await supabase.from("contact_log").insert({
      appointment_id: appointmentId, contact_type: type, contact_at: timestamp.toISOString(),
      registered_by: userId, note: note.trim() || null,
    });
    if (writeError) setError(writeError.message);
    else { setOpen(false); setNote(""); await load(); }
    setSaving(false);
  }

  return <section className="space-y-3 border-t pt-4">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Contatos do cliente</h3><Button variant="outline" size="sm" onClick={() => { setOpen((value) => !value); setAt(localInputDate(new Date())); setError(""); }}><MessageSquarePlus /> Registrar contato</Button></div>
    {open && <form onSubmit={save} className="grid gap-3 border-y py-4 sm:grid-cols-2">
      <label className="text-xs font-medium uppercase text-muted-foreground">Tipo
        <select value={type} onChange={(event) => setType(event.target.value as "ligação" | "mensagem")} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="ligação">Ligação</option><option value="mensagem">Mensagem</option></select>
      </label>
      <label className="text-xs font-medium uppercase text-muted-foreground">Data e hora
        <Input required type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} className="mt-1" />
      </label>
      <label className="text-xs font-medium uppercase text-muted-foreground sm:col-span-2">Nota (opcional)
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" />
      </label>
      <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar contato"}</Button></div>
    </form>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {rows === null ? <p className="text-sm text-muted-foreground">Carregando contatos…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum contato registrado.</p> : <ul className="divide-y">{rows.map((row) => <li key={row.id} className="py-3 text-sm"><div className="flex flex-wrap gap-x-2 font-medium"><span className="capitalize">{row.contact_type}</span><span>· {dateTime.format(new Date(row.contact_at))}</span><span className="text-muted-foreground">· {row.profiles?.full_name || "Usuário sem nome"}</span></div>{row.note && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{row.note}</p>}</li>)}</ul>}
  </section>;
}