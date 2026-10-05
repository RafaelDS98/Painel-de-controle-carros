import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dash, formatDateBR, foldKey } from "@/lib/agenda-safety";
import { safeText } from "@/lib/normalize";
import type { ModuleKey } from "@/lib/modules";

type Row = {
  id: string; date: string; time: string; plate: string; brand: string; model: string; contact: string; contact_number: string; issue: string; note: string;
  status: string; current_deadline: string | null; priority_urgent: boolean; workshop: string; forwarded_at: string | null; forwarded_workshop_id: string | null;
};
const columns = "id, date, time, plate, brand, model, contact, contact_number, issue, note, status, current_deadline, priority_urgent, workshop, forwarded_at, forwarded_workshop_id";

/** Veículos encaminhados à oficina. O banco (RLS) já limita a oficina do usuário; quem tem a Agenda vê todos os encaminhados. */
export function OficinaPage({ modules, onSignOut }: { modules: ModuleKey[]; onSignOut?: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      const [list, workshops] = await Promise.all([
        supabase.from("appointments").select(columns).not("forwarded_workshop_id", "is", null).is("archived_at", null).order("forwarded_at", { ascending: false }).limit(1000),
        supabase.from("workshops").select("id, name"),
      ]);
      if (!active) return;
      if (list.error) { setError("Não foi possível carregar os veículos da oficina. Tente de novo."); setRows([]); return; }
      setNames(Object.fromEntries((workshops.data ?? []).map((row) => [row.id, row.name])));
      setRows(list.data as Row[]);
    })();
    return () => { active = false; };
  }, []);
  const shown = useMemo(() => (rows ?? []).filter((row) => !query.trim() || [row.plate, row.model, row.brand, row.contact, row.issue].some((value) => foldKey(value).includes(foldKey(query)))), [rows, query]);
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const row of shown) { const key = names[row.forwarded_workshop_id ?? ""] ?? (row.workshop || "Oficina"); map.set(key, [...(map.get(key) ?? []), row]); }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [shown, names]);
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div><p className="text-xs font-semibold uppercase text-accent-foreground">Oficina</p><h1 className="text-2xl font-bold">Veículos encaminhados</h1><p className="text-sm text-muted-foreground">Veículos que a recepção encaminhou para a oficina.</p></div>
      <div className="flex gap-2">{modules.includes("agenda") && <Button asChild variant="secondary"><Link to="/">Agenda</Link></Button>}{modules.includes("historicos") && <Button asChild variant="secondary"><Link to="/historicos">Históricos</Link></Button>}{onSignOut && <Button variant="outline" onClick={onSignOut}>Sair</Button>}</div>
    </div></header>
    <main className="mx-auto max-w-5xl space-y-4 px-5 py-6">
      <Input value={query} placeholder="Buscar placa, modelo, cliente ou serviço" aria-label="Buscar veículo" onChange={(e) => setQuery(e.target.value)} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {rows === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : groups.length === 0 ? <p className="text-sm text-muted-foreground">{rows.length ? "Nenhum veículo encontrado com essa busca." : "Nenhum veículo encaminhado para a oficina no momento."}</p>
        : groups.map(([name, items]) => <section key={name} className="space-y-2"><h2 className="font-semibold">{name} <span className="text-sm font-normal text-muted-foreground">· {items.length} veículo(s)</span></h2>
          <ul className="space-y-2">{items.map((row) => <li key={row.id} className="rounded-md border bg-card p-3 text-sm">
            <p className="font-semibold">{dash(row.plate)} · {[row.brand, row.model].map(safeText).filter(Boolean).join(" ") || "Modelo não informado"}{row.priority_urgent && <span className="ml-2 rounded bg-destructive px-1.5 py-0.5 text-xs text-destructive-foreground">Urgente</span>}</p>
            <p className="text-muted-foreground">Situação: {dash(row.status)} · Atendimento: {formatDateBR(row.date)} {row.time}{row.current_deadline ? ` · Previsão de entrega: ${formatDateBR(row.current_deadline)}` : ""}</p>
            <p>Cliente: {dash(row.contact)} · Telefone: {dash(row.contact_number)}</p>
            {row.issue && <p>Serviço: {row.issue}</p>}{row.note && <p className="text-muted-foreground">Obs.: {row.note}</p>}
          </li>)}</ul></section>)}
    </main>
  </div>;
}
