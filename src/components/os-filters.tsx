// Painel de filtros para lista de Ordens de Serviço — matching SGLOC layout.
import { useState } from "react";
import { ChevronDown, ChevronUp, Search, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/searchable-select";
import type { OsFilters, OsConfig } from "@/lib/os/os-types";
import { OS_FILTER_FIELDS, hasOsFilters, activeOsFilterCount, resetOsFilters, RECUPERADO_OPTIONS, PENDENCIA_OPTIONS, TIPO_ATENDIMENTO_OPTIONS } from "@/lib/os/os-filters";

interface OsFiltersPanelProps {
  filters: OsFilters;
  onChange: (filters: OsFilters) => void;
  config: OsConfig | null;
  onSearch: () => void;
  onClear: () => void;
}

export function OsFiltersPanel({ filters, onChange, config, onSearch, onClear }: OsFiltersPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const count = activeOsFilterCount(filters);

  const setField = <K extends keyof OsFilters>(key: K, value: OsFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  // Build option lists from config
  const statusOptions = (config?.status ?? []).map((s) => ({ value: String(s.id), label: s.label }));
  const tipoOptions = (config?.tipos ?? []).map((t) => ({ value: String(t.id), label: t.label }));
  const centroOptions = (config?.centros_custo ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }));

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        <span className="flex items-center gap-2">
          Filtros
          {count > 0 && (
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-900 dark:text-teal-300">
              {count} ativo{count > 1 ? "s" : ""}
            </span>
          )}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {/* Status */}
            <div className="space-y-1.5">
              <Label className="text-xs">Status/Legenda</Label>
              <SearchableSelect
                options={statusOptions}
                value={filters.status_id}
                onChange={(v) => setField("status_id", v)}
                placeholder="Selecione um Status"
              />
            </div>

            {/* Tipo O.S. */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo O.S./Legenda</Label>
              <SearchableSelect
                options={tipoOptions}
                value={filters.tipo_id}
                onChange={(v) => setField("tipo_id", v)}
                placeholder="Selecione um Tipo O.S"
              />
            </div>

            {/* Número O.S. */}
            <div className="space-y-1.5">
              <Label className="text-xs">Número O.S.</Label>
              <Input
                value={filters.numero}
                onChange={(e) => setField("numero", e.target.value)}
                placeholder="Número O.S."
                className="bg-yellow-50 dark:bg-yellow-950/20"
              />
            </div>

            {/* Centro de Custo */}
            <div className="space-y-1.5">
              <Label className="text-xs">C. Custo</Label>
              <SearchableSelect
                options={centroOptions}
                value={filters.centro_custo_id}
                onChange={(v) => setField("centro_custo_id", v)}
                placeholder="Selecione um Centro de Custo"
              />
            </div>

            {/* Recuperado */}
            <div className="space-y-1.5">
              <Label className="text-xs">Recuperado</Label>
              <SearchableSelect
                options={RECUPERADO_OPTIONS}
                value={filters.recuperado}
                onChange={(v) => setField("recuperado", v)}
                placeholder="Selecione..."
              />
            </div>

            {/* Referência O.S. */}
            <div className="space-y-1.5">
              <Label className="text-xs">Referência O.S.</Label>
              <Input
                value={filters.externa_ref}
                onChange={(e) => setField("externa_ref", e.target.value)}
                placeholder="Número O.S."
              />
            </div>

            {/* Data Inicial */}
            <div className="space-y-1.5">
              <Label className="text-xs">Data Inicial</Label>
              <Input
                type="date"
                value={filters.data_inicial}
                onChange={(e) => setField("data_inicial", e.target.value)}
              />
            </div>

            {/* Data Final */}
            <div className="space-y-1.5">
              <Label className="text-xs">Data Final</Label>
              <Input
                type="date"
                value={filters.data_final}
                onChange={(e) => setField("data_final", e.target.value)}
              />
            </div>

            {/* Palavra Chave */}
            <div className="space-y-1.5">
              <Label className="text-xs">Palavra Chave</Label>
              <Input
                value={filters.palavra_chave}
                onChange={(e) => setField("palavra_chave", e.target.value)}
                placeholder="Palavra Chave"
              />
            </div>

            {/* Oficina/Autopeças */}
            <div className="space-y-1.5">
              <Label className="text-xs">Oficina/Autopeças</Label>
              <Input
                value={filters.workshop_id}
                onChange={(e) => setField("workshop_id", e.target.value)}
                placeholder="Selecione um Fornecedor"
              />
            </div>

            {/* Nº Compra */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nº Compra</Label>
              <Input
                value=""
                onChange={() => {}}
                placeholder="Compra"
                disabled
              />
            </div>

            {/* Com Pendência */}
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.com_pendencia === "true"}
                  onChange={(e) => setField("com_pendencia", e.target.checked ? "true" : "")}
                  className="rounded border-gray-300"
                />
                Com Pendência(s)
              </label>
            </div>

            {/* Loja */}
            <div className="space-y-1.5">
              <Label className="text-xs">Loja</Label>
              <Input
                value={filters.store_id}
                onChange={(e) => setField("store_id", e.target.value)}
                placeholder="Loja"
              />
            </div>

            {/* Placa */}
            <div className="space-y-1.5">
              <Label className="text-xs">Placa Veículo / Prefixo</Label>
              <Input
                value={filters.plate}
                onChange={(e) => setField("plate", e.target.value.toUpperCase())}
                placeholder="PLACA"
              />
            </div>

            {/* Montadora */}
            <div className="space-y-1.5">
              <Label className="text-xs">Montadora</Label>
              <Input
                value={filters.montadora}
                onChange={(e) => setField("montadora", e.target.value)}
                placeholder="Selecione uma Marca"
                disabled
              />
            </div>

            {/* Modelo */}
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo</Label>
              <Input
                value={filters.modelo}
                onChange={(e) => setField("modelo", e.target.value)}
                placeholder="Selecione um Modelo"
                disabled
              />
            </div>

            {/* Contrato */}
            <div className="space-y-1.5">
              <Label className="text-xs">Contrato</Label>
              <Input
                value={filters.contrato}
                onChange={(e) => setField("contrato", e.target.value)}
                placeholder="Contrato"
              />
            </div>

            {/* Info Pagamento */}
            <div className="space-y-1.5">
              <Label className="text-xs">Informação de Pagamento</Label>
              <Input
                value={filters.info_pagamento}
                onChange={(e) => setField("info_pagamento", e.target.value)}
                placeholder="Selecione uma opção"
                disabled
              />
            </div>

            {/* Peça */}
            <div className="space-y-1.5">
              <Label className="text-xs">Peça (estoque)</Label>
              <Input
                value={filters.peca}
                onChange={(e) => setField("peca", e.target.value)}
                placeholder="Selecione uma Peça"
                disabled
              />
            </div>

            {/* Categoria Veículo */}
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria Veículo</Label>
              <Input
                value={filters.categoria_veiculo}
                onChange={(e) => setField("categoria_veiculo", e.target.value)}
                placeholder="Selecione"
                disabled
              />
            </div>

            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <Input
                value={filters.cliente}
                onChange={(e) => setField("cliente", e.target.value)}
                placeholder="Selecione um cliente"
                disabled
              />
            </div>

            {/* Tipo Atendimento */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo Atendimento</Label>
              <SearchableSelect
                options={TIPO_ATENDIMENTO_OPTIONS}
                value={filters.tipo_atendimento}
                onChange={(v) => setField("tipo_atendimento", v)}
                placeholder="Selecione um Tipo Atendimento"
              />
            </div>

            {/* Mecânico */}
            <div className="space-y-1.5">
              <Label className="text-xs">Mecânico</Label>
              <Input
                value={filters.mecanico}
                onChange={(e) => setField("mecanico", e.target.value)}
                placeholder="Selecione um mecânico"
                disabled
              />
            </div>

            {/* Classificação */}
            <div className="space-y-1.5">
              <Label className="text-xs">Classificação Serviço</Label>
              <Input
                value={filters.classificacao}
                onChange={(e) => setField("classificacao", e.target.value)}
                placeholder="Selecione uma classificação"
                disabled
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={onSearch} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
              <Search className="h-4 w-4" />
              Pesquisar
            </Button>
            <Button variant="outline" onClick={onClear} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}