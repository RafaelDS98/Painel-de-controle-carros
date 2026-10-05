import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogLine, fieldLabels, logSelect, type LogRow } from "@/components/edit-history";
import { formatDateBR } from "@/lib/agenda-safety";
import { logExportHeaders, logExportRows } from "@/lib/history-log";
import { toCsv } from "@/lib/agenda-safety";
import { normalizePlate } from "@/lib/normalize";

const PAGE = 25;
const EXPORT_LIMIT = 20000;

function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div><p className="text-xs font-semibold uppercase text-accent-foreground">Históricos</p><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{subtitle}</p></div>
      <div className="flex gap-2"><Button asChild variant="outline"><Link to="/historicos">Log geral</Link></Button><Button asChild variant="secondary"><Link to="/">Voltar à Agenda</Link></Button></div>
    </div></header>
    <main className="mx-auto max-w-5xl space-y-4 px-5 py-6">{children}</main>
  </div>;
}

async function loadLabels() {
  const { data } = await supabase.from("custom_field_definitions").select("field_key, label");
  return { ...fieldLabels, ...Object.fromEntries((data ?? []).map((row) => [row.field_key, row.label])) } as Record<string, string>;
}

function download(name: string, blob: Blob) {
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = name; link.click(); URL.revokeObjectURL(link.href);
}

/** Log geral de alterações com filtros e exportação (respeita os filtros aplicados). */
export function HistoryLogPage() {
  const navigate = useNavigate();
  const [labels, setLabels] = useState<Record<string, string>>(fieldLabels);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [userName, setUserName] = useState(""); const [plate, setPlate] = useState(""); const [field, setField] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const plateKey = normalizePlate(plate);
  const userKey = userName.trim().replace(/[%_,()]/g, "");
  useEffect(() => { void loadLabels().then(setLabels).catch(() => undefined); }, []);

  const build = (count: boolean) => {
    const fields = `${logSelect.replace("profiles(", `profiles${userKey ? "!inner" : ""}(`).replace("appointments(", `appointments${plateKey ? "!inner" : ""}(`)}`;
    let query = supabase.from("edit_log").select(fields, count ? { count: "exact" } : undefined);
    if (from) query = query.gte("changed_at", `${from}T00:00:00-03:00`);
    if (to) query = query.lte("changed_at", `${to}T23:59:59.999-03:00`);
    if (userKey) query = query.ilike("profiles.full_name", `%${userKey}%`);
    if (plateKey) query = query.ilike("appointments.plate", `%${plateKey}%`);
    if (field) query = query.eq("field_changed", field);
    return query.order("changed_at", { ascending: false });
  };
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void build(true).range((page - 1) * PAGE, page * PAGE - 1).then(({ data, count, error: failure }) => {
        if (!active) return;
        setError(failure ? "Não foi possível carregar o log. Tente de novo." : "");
        setRows((data ?? []) as unknown as LogRow[]); setTotal(count ?? 0);
      });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [page, from, to, userKey, plateKey, field]);

  async function exportLog(kind: "csv" | "xlsx") {
    setBusy(true); setError("");
    try {
      const all: LogRow[] = [];
      for (let offset = 0; offset < EXPORT_LIMIT; offset += 1000) {
        const { data, error: failure } = await build(false).range(offset, offset + 999);
        if (failure) throw failure;
        all.push(...((data ?? []) as unknown as LogRow[]));
        if ((data ?? []).length < 1000) break;
      }
      const exported = logExportRows(all, labels);
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "csv") download(`log-de-alteracoes-${stamp}.csv`, new Blob(["﻿", toCsv(exported, logExportHeaders)], { type: "text/csv;charset=utf-8" }));
      else {
        const XLSX = await import("xlsx");
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(exported, { header: logExportHeaders }), "Log");
        XLSX.writeFile(book, `log-de-alteracoes-${stamp}.xlsx`);
      }
      if (all.length >= EXPORT_LIMIT) setError(`Exportadas as ${EXPORT_LIMIT} alterações mais recentes; refine os filtros para ver o restante.`);
    } catch { setError("Não foi possível exportar o log. Tente de novo."); }
    setBusy(false);
  }

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const filtering = Boolean(from || to || userKey || plateKey || field);
  const fieldOptions = useMemo(() => Object.entries(labels).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [labels]);
  const reset = () => { setFrom(""); setTo(""); setUserName(""); setPlate(""); setField(""); setPage(1); };
  return <Shell title="Log de alterações" subtitle="Todas as alterações de agendamentos, mais recentes primeiro.">
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      <label className="text-xs text-muted-foreground">De<Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></label>
      <label className="text-xs text-muted-foreground">Até<Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></label>
      <label className="text-xs text-muted-foreground">Usuário<Input value={userName} placeholder="Nome do usuário" onChange={(e) => { setUserName(e.target.value); setPage(1); }} /></label>
      <label className="text-xs text-muted-foreground">Placa<Input value={plate} placeholder="ABC-1D23" onChange={(e) => { setPlate(e.target.value); setPage(1); }} /></label>
      <label className="text-xs text-muted-foreground">Campo
        <select value={field} onChange={(e) => { setField(e.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Todos</option>{fieldOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap gap-2">
      {filtering && <Button variant="outline" size="sm" onClick={reset}>Limpar filtros</Button>}
      <Button variant="outline" size="sm" disabled={busy || total === 0} onClick={() => void exportLog("csv")}><Download /> Exportar CSV</Button>
      <Button variant="outline" size="sm" disabled={busy || total === 0} onClick={() => void exportLog("xlsx")}><Download /> Exportar XLSX</Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {rows.length === 0 ? <p className="text-sm text-muted-foreground">{filtering ? "Nenhuma alteração encontrada com esses filtros." : "Nenhuma alteração registrada."}</p>
      : <ul className="space-y-2">{rows.map((row) => <LogLine key={row.id} row={{ ...row, field_changed: labels[row.field_changed] ?? row.field_changed }} withPlate onPlateClick={(value) => { const key = normalizePlate(value); if (key) void navigate({ to: "/veiculo/$plate", params: { plate: key } }); }} />)}</ul>}
    <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
      <span>{total} alteração(ões) • página {page} de {pages}</span>
      <div className="flex gap-2">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ArrowLeft /></Button>
        <Button variant="outline" size="icon" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página"><ArrowRight /></Button>
      </div>
    </div>
  </Shell>;
}

type VehicleRow = { id: string; date: string; time: string; plate: string; status: string; model: string; contact: string; workshop: string; issue: string; archived_at: string | null };

/** Página do veículo por placa: agendamentos e linha do tempo de alterações. */
export function VehicleHistoryPage({ plate }: { plate: string }) {
  const [labels, setLabels] = useState<Record<string, string>>(fieldLabels);
  const [items, setItems] = useState<VehicleRow[] | null>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLabels(await loadLabels());
        const key = normalizePlate(plate);
        if (!key) { if (active) setItems([]); return; }
        const { data, error: failure } = await supabase.from("appointments").select("id, date, time, plate, status, model, contact, workshop, issue, archived_at").ilike("plate", `%${key}%`).order("date", { ascending: false }).order("time", { ascending: false }).limit(500);
        if (failure) throw failure;
        const mine = (data ?? []).filter((row) => normalizePlate(row.plate) === key) as VehicleRow[];
        if (!active) return;
        setItems(mine);
        const ids = mine.map((row) => row.id);
        const collected: LogRow[] = [];
        for (let i = 0; i < ids.length; i += 100) {
          const { data: part, error: logFailure } = await supabase.from("edit_log").select(logSelect).in("appointment_id", ids.slice(i, i + 100)).order("changed_at", { ascending: false }).limit(1000);
          if (logFailure) throw logFailure;
          collected.push(...((part ?? []) as unknown as LogRow[]));
        }
        collected.sort((a, b) => b.changed_at.localeCompare(a.changed_at));
        if (active) setLog(collected);
      } catch { if (active) { setError("Não foi possível carregar o histórico do veículo."); setItems((current) => current ?? []); } }
    })();
    return () => { active = false; };
  }, [plate]);
  return <Shell title={`Veículo ${plate || "não informado"}`} subtitle="Todos os agendamentos desta placa e as alterações registradas.">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <section className="space-y-2"><h2 className="font-semibold">Agendamentos</h2>
      {items === null ? <p className="text-sm text-muted-foreground">Carregando…</p> : items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado para esta placa.</p>
        : <ul className="space-y-2">{items.map((row) => <li key={row.id} className="rounded-md border bg-card p-3 text-sm">
          <p className="font-semibold">{formatDateBR(row.date)} {row.time ? `· ${row.time}` : ""} · {row.status || "Sem situação"}{row.archived_at ? " · na Lixeira" : ""}</p>
          <p className="text-muted-foreground">{[row.model, row.contact, row.workshop].filter(Boolean).join(" · ") || "—"}</p>
          {row.issue && <p>{row.issue}</p>}
        </li>)}</ul>}
    </section>
    <section className="space-y-2"><h2 className="font-semibold">Linha do tempo de alterações</h2>
      {log.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma alteração registrada.</p>
        : <ul className="space-y-2">{log.map((row) => <LogLine key={row.id} row={{ ...row, field_changed: labels[row.field_changed] ?? row.field_changed }} />)}</ul>}
    </section>
  </Shell>;
}
