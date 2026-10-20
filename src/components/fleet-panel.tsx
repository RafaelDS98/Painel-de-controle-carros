import { useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/searchable-select";
import {
  fleetFields,
  fleetValue,
  matchesFleet,
  importFleetRow,
  canCreateVehicle,
} from "@/lib/fleet";
import { fixSheetRange } from "@/lib/sheet-range";
import { guardFormula } from "@/lib/agenda-safety";
import { normalizePlate } from "@/lib/normalize";
import { Plus, Search, RotateCcw, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { VehicleCheckIn } from "@/components/vehicle-check-in";
import { Link } from "@tanstack/react-router";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
type Vehicle = Tables<"vehicles">;
async function fetchFleet() {
  const all: Vehicle[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("plate")
      .range(start, start + 999);
    if (error) throw error;
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return all;
}
export function FleetPanel({ role }: { role: string }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["fleet"], queryFn: fetchFleet });
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [ageMode, setAgeMode] = useState("gte");
  const [sortFinal, setSortFinal] = useState(false);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Vehicle | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState("");
  const [newRow, setNewRow] = useState({
    plate: "",
    modelo: "",
    fabricante: "",
    loja_op: "",
    categoria: "",
    km_atual: "",
  });
  const rows = useMemo(() => {
    const r = (query.data ?? []).filter((v) => matchesFleet(v, filters, ageMode));
    return sortFinal
      ? r.sort(
          (a, b) =>
            normalizePlate(a.plate).slice(-1).localeCompare(normalizePlate(b.plate).slice(-1)) ||
            a.plate.localeCompare(b.plate),
        )
      : r;
  }, [query.data, filters, ageMode, sortFinal]);
  const orders = useQuery({
    queryKey: ["fleet-os", detail?.id],
    enabled: !!detail,
    queryFn: async () => {
      if (!detail) return [];
      const { data, error } = await supabase.rpc("search_ordens_servico", {
        _filters: { plate: detail.plate },
        _page: 1,
        _page_size: 100,
      });
      if (error) throw error;
      return (data as { rows?: Record<string, unknown>[] })?.rows ?? [];
    },
  });
  async function add() {
    const plate = normalizePlate(newRow.plate);
    if (!/^[A-Z]{3}[A-Z0-9]{4}$/.test(plate)) {
      toast.error("Informe uma placa válida.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("vehicles").insert({
      ...newRow,
      plate,
      km_atual: newRow.km_atual === "" ? null : Number(newRow.km_atual),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewOpen(false);
    setNewRow({ plate: "", modelo: "", fabricante: "", loja_op: "", categoria: "", km_atual: "" });
    await qc.invalidateQueries({ queryKey: ["fleet"] });
    toast.success("Veículo cadastrado.");
  }
  async function importFile(file: File) {
    setBusy(true);
    let added = 0,
      updated = 0,
      ignored = 0;
    const errors: string[] = [];
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0] ?? ""];
      if (!sheet) throw Error("Planilha vazia");
      fixSheetRange(sheet, XLSX.utils);
      const source = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
      const existing = await fetchFleet();
      const map = new Map(existing.map((v) => [normalizePlate(v.plate), v]));
      const seen = new Set<string>();
      for (let i = 0; i < source.length; i++) {
        const row = importFleetRow(source[i] ?? {});
        if (!row) {
          ignored++;
          continue;
        }
        const plate = String(row["plate"]);
        if (seen.has(plate)) {
          ignored++;
          continue;
        }
        seen.add(plate);
        const current = map.get(plate);
        const r = current
          ? await supabase
              .from("vehicles")
              .update({
                ...row,
                extra_data: {
                  ...((current.extra_data ?? {}) as Record<string, unknown>),
                  ...((row["extra_data"] ?? {}) as Record<string, unknown>),
                },
              } as TablesUpdate<"vehicles">)
              .eq("id", current.id)
          : await supabase.from("vehicles").insert(row as TablesInsert<"vehicles">);
        if (r.error) errors.push(`Linha ${i + 2}: ${r.error.message}`);
        else if (current) updated++;
        else added++;
      }
      setSummary(
        `${added} novos · ${updated} atualizados · ${ignored} ignorados · ${errors.length} erros${errors.length ? " · " + errors.slice(0, 10).join(" | ") : ""}`,
      );
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setBusy(false);
    }
  }
  async function exportRows() {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.json_to_sheet(
      rows.map((v) =>
        Object.fromEntries(
          Object.entries(fleetFields).map(([k, l]) => [l, guardFormula(fleetValue(v, k))]),
        ),
      ),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Veículos");
    XLSX.writeFile(book, "veiculos.xlsx");
  }
  const free = new Set(["plate", "chassi", "prefixo", "ano", "ano_modelo", "idade", "final"]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Veículos</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void exportRows()} disabled={!rows.length}>
            <Download />
            Excel
          </Button>
          {canCreateVehicle(role) && (
            <>
              <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
                <Upload />
                {busy ? "Importando…" : "Importar frota"}
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                ref={input}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importFile(file);
                  e.target.value = "";
                }}
              />
              <Button onClick={() => setNewOpen(true)}>
                <Plus />
                Novo veículo
              </Button>
            </>
          )}
        </div>
      </div>
      {summary && (
        <p role="status" className="text-sm">
          {summary}
        </p>
      )}
      <form
        className="space-y-3 border-b pb-4"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
          setPage(1);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Object.entries(fleetFields).map(([k, label]) => {
            const options = [
              ...new Set((query.data ?? []).map((v) => fleetValue(v, k)).filter(Boolean)),
            ].sort();
            const unavailable = !free.has(k) && options.length === 0;
            return (
              <label key={k} className="min-w-0 text-xs text-muted-foreground">
                {label}
                {free.has(k) ? (
                  <Input
                    aria-label={label}
                    value={draft[k] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                    type={k === "idade" ? "number" : "text"}
                  />
                ) : unavailable ? (
                  <Input disabled placeholder="Sem dados disponíveis" />
                ) : (
                  <SearchableSelect
                    label={`Todos: ${label}`}
                    options={options}
                    value={draft[k] ?? ""}
                    onChange={(v) => setDraft({ ...draft, [k]: v })}
                  />
                )}
              </label>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            Idade{" "}
            <select
              className="rounded-md border bg-background p-2"
              value={ageMode}
              onChange={(e) => setAgeMode(e.target.value)}
            >
              <option value="gte">Maior ou igual</option>
              <option value="lte">Menor ou igual</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sortFinal}
              onChange={(e) => setSortFinal(e.target.checked)}
            />
            Ordenar por final da placa
          </label>
          <Button>
            <Search />
            Pesquisar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setDraft({});
              setFilters({});
              setPage(1);
            }}
          >
            <RotateCcw />
            Limpar
          </Button>
        </div>
      </form>
      {query.isError ? (
        <p role="alert" className="text-destructive">
          Não foi possível carregar a frota.{" "}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Tentar novamente
          </Button>
        </p>
      ) : query.isLoading ? (
        <p>Carregando veículos…</p>
      ) : (
        <>
          <p className="text-sm font-semibold">{rows.length} veículos</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted">
                <tr>
                  {[
                    "Placa",
                    "Modelo",
                    "Montadora",
                    "Loja",
                    "Posição operacional",
                    "Categoria",
                    "KM",
                    "Situação",
                  ].map((l) => (
                    <th className="p-3" key={l}>
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice((page - 1) * 30, page * 30).map((v) => (
                  <tr key={v.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <Button
                        variant="link"
                        className="p-0 text-foreground"
                        onClick={() => setDetail(v)}
                      >
                        {v.plate}
                      </Button>
                    </td>
                    {[
                      "modelo",
                      "fabricante",
                      "loja_op",
                      "pos_operacional",
                      "categoria",
                      "km_atual",
                      "status",
                    ].map((k) => (
                      <td className="p-3" key={k}>
                        {String(v[k as keyof Vehicle] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <p>Nenhum veículo encontrado.</p>}
          <div className="flex items-center justify-between">
            <p className="text-sm">
              Página {page} de {Math.max(1, Math.ceil(rows.length / 30))}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={page * 30 >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Veículo {detail?.plate}</DialogTitle>
          </DialogHeader>
          {detail && (
            <>
              <dl className="grid gap-3 sm:grid-cols-3">
                {Object.entries(fleetFields).map(([k, l]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{l}</dt>
                    <dd className="break-words text-sm">{fleetValue(detail, k) || "—"}</dd>
                  </div>
                ))}
              </dl>
              <VehicleCheckIn plate={String(detail.plate)} />
              <h2 className="font-semibold">Ordens de Serviço</h2>
              {orders.isError ? (
                <p>Consulta de O.S. indisponível para este acesso.</p>
              ) : orders.isLoading ? (
                <p>Carregando…</p>
              ) : orders.data?.length ? (
                orders.data.map((o) => (
                  <p key={String(o["id"])}>
                    <Button asChild variant="link" className="p-0">
                      <Link to="/ordens-servico/$id" params={{ id: String(o["id"]) }}>
                        O.S. {String(o["numero"])}
                      </Link>
                    </Button>{" "}
                    · {String(o["status_label"] ?? "—")} · {String(o["workshop_name"] ?? "—")}
                  </p>
                ))
              ) : (
                <p>Nenhuma O.S. encontrada.</p>
              )}
              <details>
                <summary>Dados adicionais do cadastro</summary>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {Object.entries((detail.extra_data ?? {}) as Record<string, unknown>).map(
                    ([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-muted-foreground">{k}</dt>
                        <dd className="break-words text-sm">{String(v ?? "—")}</dd>
                      </div>
                    ),
                  )}
                </dl>
              </details>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo veículo</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(newRow).map(([k, v]) => (
                <label className="text-sm" key={k}>
                  {k === "km_atual" ? "KM" : (fleetFields[k] ?? k)}
                  <Input
                    required={k === "plate"}
                    maxLength={k === "plate" ? 10 : 200}
                    type={k === "km_atual" ? "number" : "text"}
                    min={k === "km_atual" ? 0 : undefined}
                    value={v}
                    onChange={(e) => setNewRow({ ...newRow, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewOpen(false)}>
                Cancelar
              </Button>
              <Button disabled={busy}>{busy ? "Salvando…" : "Cadastrar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
