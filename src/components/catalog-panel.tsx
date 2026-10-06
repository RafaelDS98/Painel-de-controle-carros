import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATALOG_KINDS, catalogLabels, hasSglocId, type CatalogKind } from "@/lib/catalog";
import { formatDateTimeBR } from "@/lib/agenda-safety";

type Row = { id: string; name: string; active: boolean; sgloc_id: number | null; source: string };
type Log = { id: string; changed_at: string; kind: string; item_name: string; action: string; detail: string };

/** Configurações > Listas (só master): renomear, desativar e vincular ID SGLOC. */
export function CatalogPanel({ onChanged }: { onChanged: () => Promise<void> }) {
  const [kind, setKind] = useState<CatalogKind>("workshop");
  const [rows, setRows] = useState<Row[]>([]);
  const [edit, setEdit] = useState<Record<string, { name: string; sgloc: string; active: boolean }>>({});
  const [logs, setLogs] = useState<Log[]>([]);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  async function load() {
    const list = kind === "workshop"
      ? (await supabase.from("workshops").select("id, name, active, source").order("name")).data?.map((w) => ({ ...w, sgloc_id: null })) ?? []
      : (await supabase.from("catalog_items").select("id, name, active, sgloc_id, source").eq("kind", kind).order("name")).data ?? [];
    setRows(list); setEdit({});
    const { data } = await supabase.from("catalog_log").select("*").order("changed_at", { ascending: false }).limit(30);
    setLogs(data ?? []);
  }
  useEffect(() => { void load(); }, [kind]);

  async function save(row: Row) {
    const e = edit[row.id]; if (!e) return;
    const sgloc = e.sgloc.trim() ? Number(e.sgloc) : null;
    if (sgloc !== null && (!Number.isInteger(sgloc) || sgloc <= 0)) { setMsg({ error: "O ID SGLOC deve ser um número inteiro." }); return; }
    const { data, error } = await supabase.rpc("catalog_update", { _kind: kind, _id: row.id, _name: e.name, _sgloc_id: sgloc as number, _active: e.active });
    if (error) { setMsg({ error: error.message }); return; }
    setMsg({ ok: `Salvo.${data ? ` ${data} agendamento(s) atualizado(s).` : ""}` });
    await load(); await onChanged();
  }

  return <section className="space-y-3">
    <div className="flex flex-wrap gap-2">{CATALOG_KINDS.map((k) => <Button key={k} size="sm" variant={k === kind ? "default" : "outline"} onClick={() => { setKind(k); setMsg({}); }}>{catalogLabels[k].title}</Button>)}</div>
    <p className="text-xs text-muted-foreground">{kind === "sector" ? "Setor é só um rótulo do usuário (sem permissões). Renomear atualiza os usuários ligados. " : ""}Renomear atualiza os agendamentos ligados (inclusive na Lixeira) e entra no histórico. Desativar tira da lista de escolha, mas o nome continua nos agendamentos que já o usam.{kind === "store" ? " Loja sem ID SGLOC não é enviada ao SGLOC." : ""}</p>
    {msg.error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg.error}</p>}
    {msg.ok && <p className="text-sm text-muted-foreground">{msg.ok}</p>}
    <ul className="divide-y rounded-md border">{rows.map((row) => {
      const e = edit[row.id];
      return <li key={row.id} className="flex flex-wrap items-center gap-2 p-2 text-sm">
        {e ? <>
          <Input className="min-w-40 flex-1" value={e.name} onChange={(ev) => setEdit({ ...edit, [row.id]: { ...e, name: ev.target.value } })} />
          {hasSglocId(kind) && <Input className="w-28" placeholder="ID SGLOC" inputMode="numeric" value={e.sgloc} onChange={(ev) => setEdit({ ...edit, [row.id]: { ...e, sgloc: ev.target.value } })} />}
          <label className="flex items-center gap-1"><input type="checkbox" checked={e.active} onChange={(ev) => setEdit({ ...edit, [row.id]: { ...e, active: ev.target.checked } })} />Ativo</label>
          <Button size="sm" onClick={() => void save(row)}>Salvar</Button><Button size="sm" variant="outline" onClick={() => { const { [row.id]: _, ...rest } = edit; setEdit(rest); }}>Cancelar</Button>
        </> : <>
          <span className={row.active ? "flex-1 font-medium" : "flex-1 text-muted-foreground line-through"}>{row.name}</span>
          {hasSglocId(kind) && <span className={row.sgloc_id === null ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{row.sgloc_id === null ? "sem vínculo SGLOC" : `ID SGLOC ${row.sgloc_id}`}</span>}
          <span className="text-xs text-muted-foreground">{row.source}</span>
          <Button size="sm" variant="outline" onClick={() => setEdit({ ...edit, [row.id]: { name: row.name, sgloc: row.sgloc_id?.toString() ?? "", active: row.active } })}>Editar</Button>
        </>}
      </li>;
    })}</ul>
    <h4 className="pt-2 font-semibold">Últimas alterações nas listas</h4>
    <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">{logs.length ? logs.map((l) => <li key={l.id}>{formatDateTimeBR(l.changed_at)} · {catalogLabels[l.kind as CatalogKind]?.title ?? l.kind} · {l.action === "add" ? "adicionado" : "alterado"} "{l.item_name}" · {l.detail}</li>) : <li>Nenhuma alteração ainda.</li>}</ul>
  </section>;
}
