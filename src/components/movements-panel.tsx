import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/searchable-select";
import { dash, formatDateBR, formatDateTimeBR, toCsv } from "@/lib/agenda-safety";
import { normalizeTime } from "@/lib/normalize";
import { cn } from "@/lib/utils";
import {
  actorLabel, deadlineSlipped, emptyMovementFilters, eventHeaders, eventRows, eventValue, fieldLabel, formatDuration, hasCriteria, parseResult,
  passHeaders, passRows, rpcArgs, statusSpans, timeToCompletion, vehicleSummary, type MovementFilters, type MovementResult, type Pass, type Vehicle,
} from "@/lib/movements";

const SERVICES = ["Corretiva", "Freios", "Pneus", "Revisão", "Suspensão"];
const PAGE = 20;
type Opts = { status: string[]; store: string[]; workshop: string[]; mechanic: string[]; sector: string[]; completion: string };

/** Aba Movimentações: histórico por veículo. Nasce vazia; só consulta com algum critério. */
export function MovementsPanel({ isMaster, request }: { isMaster: boolean; request: { plate: string; nonce: number } | null }) {
  const [f, setF] = useState<MovementFilters>(emptyMovementFilters);
  const [opts, setOpts] = useState<Opts>({ status: [], store: [], workshop: [], mechanic: [], sector: [], completion: "" });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<MovementResult | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [hint, setHint] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const last = useRef<MovementFilters | null>(null);

  useEffect(() => {
    void (async () => {
      const [st, items, shops] = await Promise.all([
        supabase.from("status_options").select("label, is_completion").order("sort_order"),
        supabase.from("catalog_items").select("kind, name").eq("active", true).order("name"),
        supabase.from("workshops").select("name").eq("active", true).order("name"),
      ]);
      const by = (k: string) => (items.data ?? []).filter((i) => i.kind === k).map((i) => i.name);
      setOpts({ status: (st.data ?? []).map((s) => s.label), completion: (st.data ?? []).find((s) => s.is_completion)?.label ?? "",
        store: by("store"), mechanic: by("mechanic"), sector: [...by("sector"), "(sem valor)"], workshop: (shops.data ?? []).map((w) => w.name) });
    })();
  }, []);

  async function run(filters: MovementFilters, toPage: number) {
    if (!hasCriteria(filters)) { setHint("Informe ao menos um critério para pesquisar."); return; }
    setHint(""); setState("loading"); last.current = filters;
    const { data, error } = await supabase.rpc("search_vehicle_movements", rpcArgs(filters, toPage, PAGE) as never);
    if (error) { setState("error"); return; }
    setResult(parseResult(data)); setPage(toPage); setState("idle"); setOpen({});
  }

  useEffect(() => {
    if (!request?.plate) return;
    const next = { ...emptyMovementFilters(), plate: request.plate };
    setF(next); void run(next, 1);
  }, [request?.nonce]);

  const set = <K extends keyof MovementFilters>(k: K, v: MovementFilters[K]) => setF((c) => ({ ...c, [k]: v }));
  const clear = () => { setF(emptyMovementFilters()); setResult(null); setHint(""); setState("idle"); last.current = null; };
  const pages = result ? Math.max(1, Math.ceil(result.total_vehicles / PAGE)) : 1;

  function exportFile(kind: "csv" | "xlsx", withEvents: boolean) {
    if (!result) return;
    const rows = passRows(result.vehicles, opts.completion); const evs = eventRows(result.vehicles);
    if (kind === "csv") {
      const save = (text: string, name: string) => { const blob = new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href); };
      save(toCsv(rows, passHeaders), "movimentacoes.csv");
      if (withEvents) save(toCsv(evs, eventHeaders), "movimentacoes-eventos.csv");
      return;
    }
    void import("xlsx").then((XLSX) => {
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows, { header: passHeaders }), "Passagens");
      if (withEvents) XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(evs, { header: eventHeaders }), "Eventos de situação");
      XLSX.writeFile(book, "movimentacoes.xlsx");
    });
  }

  return <div className="space-y-4">
    <div><p className="mb-1 text-xs font-semibold uppercase text-accent-foreground">Histórico por veículo</p><h1 className="text-2xl font-bold lg:text-3xl">Movimentações</h1></div>
    <form className="space-y-3 rounded-lg border bg-card p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); void run(f, 1); }}>
      <div className="flex flex-wrap gap-2">
        <label className="relative min-w-56 flex-1"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={f.plate} onChange={(e) => set("plate", e.target.value)} placeholder="Placa (ex.: ABC1D23 ou ABC)" className="pl-9" aria-label="Placa" /></label>
        <Input type="date" aria-label="Período de" value={f.from} onChange={(e) => set("from", e.target.value)} className="w-40" />
        <Input type="date" aria-label="Período até" value={f.to} onChange={(e) => set("to", e.target.value)} className="w-40" />
        <SearchableSelect label="Todas as situações" value={f.status} options={opts.status} onChange={(v) => set("status", v)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <SearchableSelect label="Todas as lojas" value={f.store} options={opts.store} onChange={(v) => set("store", v)} />
        <SearchableSelect label="Todos os locais/oficinas" value={f.workshop} options={opts.workshop} onChange={(v) => set("workshop", v)} />
        <SearchableSelect label="Todos os mecânicos" value={f.mechanic} options={opts.mechanic} onChange={(v) => set("mechanic", v)} />
        <SearchableSelect label="Todos os tipos de serviço" value={f.service} options={SERVICES} onChange={(v) => set("service", v)} />
        <SearchableSelect label="Todos os setores" value={f.sector} options={opts.sector} onChange={(v) => set("sector", v)} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">Urgente<select className="h-10 rounded-md border bg-background px-2" value={f.urgent} onChange={(e) => set("urgent", e.target.value as MovementFilters["urgent"])}><option value="">Todos</option><option value="sim">Sim</option><option value="nao">Não</option></select></label>
        <label className="flex items-center gap-2">Retrabalho<select className="h-10 rounded-md border bg-background px-2" value={f.rework} onChange={(e) => set("rework", e.target.value as MovementFilters["rework"])}><option value="">Todos</option><option value="sim">Sim</option><option value="nao">Não</option></select></label>
        {isMaster && <label className="flex items-center gap-2"><Checkbox checked={f.includeArchived} onCheckedChange={(c) => set("includeArchived", c === true)} />Incluir Lixeira</label>}
        <div className="ml-auto flex gap-2"><Button type="submit" disabled={state === "loading"}><Search />{state === "loading" ? "Pesquisando…" : "Pesquisar"}</Button><Button type="button" variant="outline" onClick={clear}><X />Limpar</Button></div>
      </div>
      {hint && <p role="alert" className="text-sm text-destructive">{hint}</p>}
    </form>

    {state === "error" && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">Não foi possível carregar as movimentações. Tente de novo.</p>}
    {!result && state !== "error" && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{state === "loading" ? "Carregando movimentações…" : "Pesquise por placa, período, situação ou outro filtro para ver as movimentações."}</p>}
    {result && <section aria-label="Resultado das movimentações" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{result.total_vehicles} veículo(s) · {result.total_passes} passagem(ns)</p>
        {result.total_passes > 0 && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => exportFile("csv", false)}><Download />CSV</Button><Button variant="outline" size="sm" onClick={() => exportFile("xlsx", false)}><Download />Excel</Button><Button variant="outline" size="sm" onClick={() => exportFile("xlsx", true)}><Download />Excel + eventos</Button><Button variant="outline" size="sm" onClick={() => exportFile("csv", true)}><Download />CSV + eventos</Button></div>}
      </div>
      {result.vehicles.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum veículo encontrado com esses filtros.</p>
        : result.vehicles.map((v) => <VehicleCard key={v.plate_key || "sem-placa"} v={v} completion={opts.completion} open={Boolean(open[v.plate_key])} onToggle={() => setOpen((c) => ({ ...c, [v.plate_key]: !c[v.plate_key] }))} />)}
      {pages > 1 && <div className="flex items-center justify-between"><p className="text-xs text-muted-foreground">Página {page} de {pages}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1 || state === "loading"} onClick={() => last.current && void run(last.current, page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page >= pages || state === "loading"} onClick={() => last.current && void run(last.current, page + 1)}>Próxima</Button></div></div>}
    </section>}
  </div>;
}

function VehicleCard({ v, completion, open, onToggle }: { v: Vehicle; completion: string; open: boolean; onToggle: () => void }) {
  const s = vehicleSummary(v);
  return <article className="rounded-lg border bg-card shadow-sm">
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-11 w-full flex-wrap items-start justify-between gap-3 p-4 text-left hover:bg-muted/40">
      <div><p className="flex items-center gap-1 text-lg font-bold text-primary">{open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}{s.plate}</p><p className="text-sm text-muted-foreground">{s.vehicle}</p></div>
      <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p><span className="text-muted-foreground">Passagens:</span> <strong>{s.count}</strong></p>
        <p><span className="text-muted-foreground">Primeira/última:</span> {formatDateBR(s.first)} — {formatDateBR(s.last)}</p>
        <p><span className="text-muted-foreground">Situação atual:</span> {s.currentStatus}</p>
        <p><span className="text-muted-foreground">Serviços:</span> {s.services.join(", ") || "—"}</p>
      </div>
    </button>
    {open && <ol className="space-y-3 border-t p-4">{v.passes.map((p) => <PassItem key={p.id} p={p} completion={completion} />)}</ol>}
  </article>;
}

function PassItem({ p, completion }: { p: Pass; completion: string }) {
  const spans = statusSpans(p).filter((x) => x.ms > 0 || x.to === null);
  const total = timeToCompletion(p, completion);
  const events = p.events.map((e) => ({ e, label: fieldLabel(e.field) })).filter((x) => x.label).reverse();
  const row = (k: string, val: unknown) => <p><span className="text-muted-foreground">{k}:</span> {dash(val)}</p>;
  return <li id={`pass-${p.id}`} className={cn("rounded-md border p-3 text-sm", p.archived && "border-dashed opacity-80")}>
    <div className="mb-2 flex flex-wrap items-center gap-2"><strong>{formatDateBR(p.date)} {normalizeTime(p.time)}</strong><span className="rounded border px-2 py-0.5 text-xs">{p.status || "Não atualizada"}</span><span className="text-xs text-muted-foreground">{p.service}</span>
      {p.urgent && <span className="rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Urgente</span>}
      {p.rework_of && <a href={`#pass-${p.rework_of}`} className="rounded border border-accent bg-accent/30 px-2 py-0.5 text-xs font-semibold text-accent-foreground underline">Retrabalho de {p.rework_original ? formatDateBR(p.rework_original.date) : "outra passagem"}</a>}
      {p.archived && <span className="text-xs text-muted-foreground">(na Lixeira)</span>}</div>
    <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
      {row("Loja", p.store)}{row("Local/Oficina", p.workshop)}{row("Mecânico", p.mechanic)}{row("Operador", p.operator)}
      {row("Tipo", p.schedule_type === "E" ? "Emergencial (E)" : "Normal (N)")}{row("O.S externa", p.external_order)}{row("O.S fornecedor", p.os_number)}{row("KM", p.km)}
      <p><span className="text-muted-foreground">Previsão:</span> {formatDateBR(p.original_deadline)} → {formatDateBR(p.current_deadline)}{deadlineSlipped(p) && <span className="ml-1 font-semibold text-destructive">(adiada)</span>}</p>
      {row("Entrada no painel", formatDateTimeBR(p.created_at))}
    </div>
    <p className="mt-2"><span className="text-muted-foreground">Problema/serviço:</span> {dash(p.issue)}</p>
    {p.rework_reason && <p><span className="text-muted-foreground">Motivo do retrabalho:</span> {p.rework_reason}</p>}
    {p.note && <p><span className="text-muted-foreground">Observação:</span> {p.note}</p>}
    {spans.length > 0 && <p className="mt-2 text-xs"><span className="font-semibold">Tempo em cada situação:</span> {spans.map((x) => `${x.status || "Sem situação"}: ${formatDuration(x.ms)}${x.to === null ? " (até agora)" : ""}`).join(" · ")}{total !== null && <> · <strong>Até {completion}: {formatDuration(total)}</strong></>}</p>}
    <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-primary">Histórico ({events.length})</summary>
      {events.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{events.map(({ e, label }, i) => <li key={i}>{formatDateTimeBR(e.at)} · {actorLabel(e.by)} · {label}: {eventValue(e.field, e.old)} → {eventValue(e.field, e.new)}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">Sem alterações registradas.</p>}
    </details>
  </li>;
}
