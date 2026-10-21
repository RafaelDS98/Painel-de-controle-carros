import { DateInput } from "@/components/date-input";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/searchable-select";
import { Badge, useOsConfig } from "@/components/ordens-servico";
import {
  money,
  NAO_FINALIZADAS,
  osConsultaFilters,
  osDate,
  PAGAMENTO_STATUS,
  parseSearch,
  TIPO_ATENDIMENTO,
  type OsRow,
} from "@/lib/os";

const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const EMPTY = {
  numero: "",
  plate: "",
  status_id: "",
  tipo_id: "",
  data_inicial: "",
  data_final: "",
  store_id: "",
  workshop_id: "",
  palavra_chave: "",
  centro_custo_id: "",
  externa_ref: "",
  numero_compra: "",
  contrato: "",
  recuperado: "",
  com_pendencia: "",
  pagamento_status: "",
  tipo_atendimento: "",
  mecanico: "",
  montadora: "",
  modelo: "",
  cliente: "",
  peca: "",
};
type Draft = typeof EMPTY;
const PAGE = 20;

/** Consultas → O.S.: busca detalhada das ordens de serviço (filtros como no SGLOC). Começa vazia; só busca ao pesquisar. */
export function OsConsultaPanel({ onOpenPlate }: { onOpenPlate?: (plate: string) => void }) {
  const config = useOsConfig();
  const brands = useQuery({
    queryKey: ["os-brands"],
    queryFn: async () =>
      (
        await supabase
          .from("catalog_items")
          .select("name")
          .eq("kind", "brand")
          .eq("active", true)
          .order("name")
      ).data?.map((b) => b.name) ?? [],
  });
  const lists = useQuery({
    queryKey: ["os-consulta-lists"],
    queryFn: async () => {
      const [os, itens] = await Promise.all([
        supabase
          .from("ordens_servico")
          .select("modelo, cliente")
          .is("archived_at", null)
          .limit(20000),
        supabase
          .from("os_itens")
          .select("part_code, description, item_type")
          .neq("item_type", "S")
          .limit(20000),
      ]);
      const uniq = (v: (string | null | undefined)[]) =>
        [...new Set(v.map((x) => (x ?? "").trim()).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b, "pt-BR"),
        );
      return {
        modelos: uniq((os.data ?? []).map((r) => r.modelo)),
        clientes: uniq((os.data ?? []).map((r) => r.cliente)),
        pecas: uniq((itens.data ?? []).map((r) => r.part_code || r.description)),
      };
    },
  });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [more, setMore] = useState(false);
  const [filters, setFilters] = useState<Record<string, string> | null>(null);
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["os-consulta", filters, page],
    enabled: filters !== null,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_ordens_servico", {
        _filters: filters ?? {},
        _page: page,
        _page_size: PAGE,
      });
      if (error) throw error;
      return {
        ...parseSearch(data),
        sum: Number((data as { sum_total?: unknown } | null)?.sum_total) || 0,
      };
    },
  });
  const set = (k: keyof Draft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));
  const centros = useMemo(() => config.data?.centros ?? [], [config.data]);
  const workshops = useMemo(() => config.data?.workshops ?? [], [config.data]);
  const labelOf = (opts: { id: string | number; label: string }[], id: string) =>
    opts.find((o) => String(o.id) === id)?.label ?? "";
  const idOf = (opts: { id: string | number; label: string }[], label: string) =>
    String(opts.find((o) => o.label === label)?.id ?? "");
  const search = () => {
    setPage(1);
    setFilters(osConsultaFilters(draft));
  };
  const clear = () => {
    setDraft(EMPTY);
    setFilters(null);
    setPage(1);
  };
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  async function exportXlsx() {
    const { data, error } = await supabase.rpc("search_ordens_servico", {
      _filters: filters ?? {},
      _page: 1,
      _page_size: 5000,
    });
    if (error) {
      toast.error("Não foi possível exportar. Tente de novo.");
      return;
    }
    const rows = parseSearch(data).rows.map((o) => ({
      Nº: o.numero,
      Placa: o.plate,
      Abertura: osDate(o.opened_at),
      Finalização: osDate(o.closed_at),
      Situação: o.status_label ?? "",
      Tipo: o.tipo_label ?? "",
      Modelo: String(o["modelo"] ?? ""),
      Loja: o.store_code ?? "",
      Oficina: o.workshop_name ?? "",
      "Centro de custo": o.centro_custo_name ?? "",
      KM: o.km ?? "",
      Pagamento: String(o["pagamento_status"] ?? ""),
      Operador: String(o["operador"] ?? ""),
      Cliente: String(o["cliente"] ?? ""),
      Total: Number(o.total_os) || 0,
    }));
    const XLSX = await import("xlsx");
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "O.S.");
    XLSX.writeFile(book, "ordens-de-servico.xlsx");
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-3 rounded-lg border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Nº da O.S.</Label>
            <Input value={draft.numero} onChange={set("numero")} inputMode="numeric" />
          </div>
          <div>
            <Label>Placa</Label>
            <Input value={draft.plate} onChange={set("plate")} placeholder="ABC1D23" />
          </div>
          <div>
            <Label>Situação</Label>
            <select className={sel} value={draft.status_id} onChange={set("status_id")}>
              <option value="">Todas</option>
              <option value={NAO_FINALIZADAS}>Não finalizadas</option>
              {config.data?.status.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Tipo de O.S.</Label>
            <select className={sel} value={draft.tipo_id} onChange={set("tipo_id")}>
              <option value="">Todos</option>
              {config.data?.tipos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Aberta de</Label>
            <DateInput value={draft.data_inicial} onChange={set("data_inicial")} />
          </div>
          <div>
            <Label>até</Label>
            <DateInput value={draft.data_final} onChange={set("data_final")} />
          </div>
          <div>
            <Label>Loja</Label>
            <select className={sel} value={draft.store_id} onChange={set("store_id")}>
              <option value="">Todas</option>
              {config.data?.stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <Label className="mb-1">Oficina/Autopeça</Label>
            <SearchableSelect
              label="Todas"
              value={labelOf(workshops, draft.workshop_id)}
              options={workshops.map((w) => w.label)}
              onChange={(v) => setDraft((d) => ({ ...d, workshop_id: idOf(workshops, v) }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Palavra-chave</Label>
            <Input
              value={draft.palavra_chave}
              onChange={set("palavra_chave")}
              placeholder="Observação, modelo, operador, item…"
            />
          </div>
        </div>
        {more && (
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col">
              <Label className="mb-1">Centro de custo</Label>
              <SearchableSelect
                label="Todos"
                value={labelOf(centros, draft.centro_custo_id)}
                options={centros.map((c) => c.label)}
                onChange={(v) => setDraft((d) => ({ ...d, centro_custo_id: idOf(centros, v) }))}
              />
            </div>
            <div>
              <Label>Referência O.S.</Label>
              <Input value={draft.externa_ref} onChange={set("externa_ref")} />
            </div>
            <div>
              <Label>Nº compra</Label>
              <Input value={draft.numero_compra} onChange={set("numero_compra")} />
            </div>
            <div>
              <Label>Contrato</Label>
              <Input value={draft.contrato} onChange={set("contrato")} />
            </div>
            <div>
              <Label>Recuperado</Label>
              <select className={sel} value={draft.recuperado} onChange={set("recuperado")}>
                <option value="">Todos</option>
                <option>Sim</option>
                <option>Não</option>
              </select>
            </div>
            <div>
              <Label>Com pendência</Label>
              <select className={sel} value={draft.com_pendencia} onChange={set("com_pendencia")}>
                <option value="">Todas</option>
                <option>Sim</option>
                <option>Não</option>
              </select>
            </div>
            <div>
              <Label>Pagamento</Label>
              <select
                className={sel}
                value={draft.pagamento_status}
                onChange={set("pagamento_status")}
              >
                <option value="">Todos</option>
                {PAGAMENTO_STATUS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Tipo de atendimento</Label>
              <select
                className={sel}
                value={draft.tipo_atendimento}
                onChange={set("tipo_atendimento")}
              >
                <option value="">Todos</option>
                {Object.entries(TIPO_ATENDIMENTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <Label className="mb-1">Mecânico</Label>
              <SearchableSelect
                label="Todos"
                value={draft.mecanico}
                options={config.data?.mechanics ?? []}
                onChange={(v) => setDraft((d) => ({ ...d, mecanico: v }))}
              />
            </div>
            <div className="flex flex-col">
              <Label className="mb-1">Montadora</Label>
              <SearchableSelect
                label="Todas"
                value={draft.montadora}
                options={brands.data ?? []}
                onChange={(v) => setDraft((d) => ({ ...d, montadora: v }))}
              />
            </div>
            <div className="flex flex-col">
              <Label className="mb-1">Modelo</Label>
              <SearchableSelect
                label="Todos"
                value={draft.modelo}
                options={lists.data?.modelos ?? []}
                onChange={(v) => setDraft((d) => ({ ...d, modelo: v }))}
              />
            </div>
            <div className="flex flex-col">
              <Label className="mb-1">Cliente</Label>
              <SearchableSelect
                label="Todos"
                value={draft.cliente}
                options={lists.data?.clientes ?? []}
                onChange={(v) => setDraft((d) => ({ ...d, cliente: v }))}
              />
            </div>
            <div className="flex flex-col">
              <Label className="mb-1">Peça (estoque)</Label>
              <SearchableSelect
                label="Todas"
                value={draft.peca}
                options={lists.data?.pecas ?? []}
                onChange={(v) => setDraft((d) => ({ ...d, peca: v }))}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Pesquisar</Button>
          <Button type="button" variant="outline" onClick={clear}>
            Limpar
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMore((m) => !m)}>
            {more ? "Menos filtros" : "Mais filtros"}
          </Button>
        </div>
      </form>

      {filters === null ? (
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Preencha um ou mais filtros e clique em Pesquisar. Sem filtros, Pesquisar mostra todas as
          O.S.
        </p>
      ) : list.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : list.isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar as ordens de serviço. Tente de novo.
        </p>
      ) : !total ? (
        <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma O.S. encontrada com esses filtros.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {total} O.S. · total {money(list.data?.sum)}
            </p>
            <Button variant="outline" size="sm" onClick={() => void exportXlsx()}>
              <Download />
              Excel
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {[
                    "Nº",
                    "Abertura",
                    "Placa",
                    "Modelo",
                    "Situação",
                    "Tipo",
                    "Loja",
                    "Oficina",
                    "Centro de custo",
                    "Pagamento",
                    "Total",
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.data?.rows.map((os: OsRow) => (
                  <tr key={os.id} className="border-t hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <Link
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        to="/ordens-servico/$id"
                        params={{ id: os.id }}
                      >
                        {os.numero}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{osDate(os.opened_at)}</td>
                    <td className="px-3 py-2 font-mono">
                      {os.plate && onOpenPlate ? (
                        <button
                          type="button"
                          className="text-primary underline-offset-2 hover:underline"
                          title="Ver histórico do veículo"
                          onClick={() => onOpenPlate(os.plate)}
                        >
                          {os.plate}
                        </button>
                      ) : (
                        os.plate || "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{String(os["modelo"] ?? "") || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge label={os.status_label} color={os.status_color} />
                    </td>
                    <td className="px-3 py-2">{os.tipo_label || "—"}</td>
                    <td className="px-3 py-2">{os.store_code || "—"}</td>
                    <td className="px-3 py-2">{os.workshop_name || "—"}</td>
                    <td className="px-3 py-2">{os.centro_custo_name || "—"}</td>
                    <td className="px-3 py-2">{String(os["pagamento_status"] ?? "") || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{money(os.total_os)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span className="text-sm">
                Página {page} de {pages}
              </span>
              <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
