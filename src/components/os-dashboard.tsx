// Dashboard principal de Ordens de Serviço — lista com filtros, tabela, paginação e exportação.
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Download, Loader2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { OsConfig, OsFilters, OsListItem, OsSearchResult } from "@/lib/os/os-types";
import { emptyOsFilters } from "@/lib/os/os-types";
import { resetOsFilters, osFiltersToRpc } from "@/lib/os/os-filters";
import { displayPlate, displayOsNumber, formatMoney, formatKm } from "@/lib/os/os-safety";
import { OS_EXPORT_HEADERS, osExportRows } from "@/lib/os/os-export";
import { searchOrdensServico, getOsConfig } from "@/lib/os/os.functions";
import { OsFiltersPanel } from "./os-filters";
import { OsStatusBadge } from "./os-status-badge";

const PAGE_SIZE = 20;

export function OsDashboard() {
  const navigate = useNavigate();
  const [config, setConfig] = useState<OsConfig | null>(null);
  const [filters, setFilters] = useState<OsFilters>({ ...emptyOsFilters });
  const [rows, setRows] = useState<OsListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Load config on mount
  useEffect(() => {
    getOsConfig({ data: {} })
      .then((cfg) => setConfig(cfg as OsConfig))
      .catch(() => toast.error("Erro ao carregar configurações."));
  }, []);

  // Search function
  const doSearch = useCallback(async (p = 1, f = filters) => {
    setSearching(true);
    try {
      const rpcFilters = osFiltersToRpc(f);
      const result = await searchOrdensServico({
        data: { filters: rpcFilters, page: p, pageSize: PAGE_SIZE },
      });
      const r = result as OsSearchResult;
      setRows(r.rows ?? []);
      setTotal(r.total ?? 0);
      setPage(p);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao buscar ordens de serviço.");
    } finally {
      setSearching(false);
      setLoading(false);
    }
  }, [filters]);

  // Initial load
  useEffect(() => { doSearch(1); }, []);

  const handleSearch = () => { setPage(1); doSearch(1, filters); };
  const handleClear = () => { const f = resetOsFilters(); setFilters(f); setPage(1); doSearch(1, f); };

  // Pagination
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const goPage = (p: number) => doSearch(p, filters);

  // Export CSV
  const handleExport = () => {
    if (rows.length === 0) { toast.info("Nenhum registro para exportar."); return; }
    const dataRows = osExportRows(rows);
    const header = OS_EXPORT_HEADERS.join(";");
    const body = dataRows.map((r) => OS_EXPORT_HEADERS.map((h) => `"${(r[h] ?? "").replace(/"/g, '""')}"`).join(";")).join("\n");
    const csv = "﻿" + header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ordens_servico_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} registro(s) exportado(s).`);
  };

  return (
    <div className="space-y-4 p-4 lg:p-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Ordens de Serviço</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => navigate({ to: "/os/nova" })}
            className="bg-teal-600 hover:bg-teal-700 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Novo
          </Button>
          <Button onClick={handleSearch} disabled={searching} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Pesquisar
          </Button>
          <Button variant="outline" onClick={handleClear}>Limpar</Button>
          <Button variant="outline" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <OsFiltersPanel
        filters={filters}
        onChange={setFilters}
        config={config}
        onSearch={handleSearch}
        onClear={handleClear}
      />

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} registro(s)</span>
        {totalPages > 1 && (
          <span>
            Página {page} de {totalPages}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Nº</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[140px]">Tipo</TableHead>
              <TableHead className="w-[100px]">Placa</TableHead>
              <TableHead className="w-[80px] text-right">KM</TableHead>
              <TableHead className="w-[100px]">Abertura</TableHead>
              <TableHead className="w-[100px]">Fechamento</TableHead>
              <TableHead>Oficina</TableHead>
              <TableHead>C. Custo</TableHead>
              <TableHead className="w-[100px] text-right">Total O.S.</TableHead>
              <TableHead className="w-[60px]">Pend.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-600" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  Sem dados. Ajuste os filtros ou crie uma nova O.S.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((os) => (
                <TableRow
                  key={os.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate({ to: "/os/$id", params: { id: os.id } })}
                >
                  <TableCell className="font-mono text-sm">{displayOsNumber(os.numero)}</TableCell>
                  <TableCell>
                    <OsStatusBadge statusId={os.status_id} label={os.status_label} color={os.status_color} size="sm" />
                  </TableCell>
                  <TableCell className="text-sm">{os.tipo_label ?? "—"}</TableCell>
                  <TableCell className="font-mono text-sm">{displayPlate(os.plate)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatKm(os.km)}</TableCell>
                  <TableCell className="text-sm">
                    {os.opened_at ? new Date(os.opened_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {os.closed_at ? new Date(os.closed_at).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-sm truncate max-w-[150px]">{os.workshop_name ?? "—"}</TableCell>
                  <TableCell className="text-sm truncate max-w-[120px]">{os.centro_custo_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-semibold">{formatMoney(os.total_os)}</TableCell>
                  <TableCell className="text-center">
                    {os.pendencia && (
                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" title="Com pendência" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => goPage(page - 1)}>
            Anterior
          </Button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            let p: number;
            if (totalPages <= 7) p = i + 1;
            else if (page <= 4) p = i + 1;
            else if (page >= totalPages - 3) p = totalPages - 6 + i;
            else p = page - 3 + i;
            return (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                className={p === page ? "bg-teal-600 hover:bg-teal-700" : ""}
                onClick={() => goPage(p)}
              >
                {p}
              </Button>
            );
          })}
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => goPage(page + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}