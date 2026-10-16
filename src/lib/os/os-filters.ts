// Lógica de filtros para lista de Ordens de Serviço — mesmo padrão de advanced-filter.ts.
import { foldKey, EMPTY_OPTION } from "../agenda-safety";
import { safeText } from "../normalize";
import type { OsFilters, OsListItem } from "./os-types";
import { emptyOsFilters } from "./os-types";

/** Campos de filtro com label e tipo. */
export interface OsFilterField {
  key: keyof OsFilters;
  label: string;
  kind: "choice" | "text" | "date" | "boolean";
}

/** Definição dos campos de filtro disponíveis. */
export const OS_FILTER_FIELDS: OsFilterField[] = [
  { key: "status_id", label: "Status", kind: "choice" },
  { key: "tipo_id", label: "Tipo O.S.", kind: "choice" },
  { key: "numero", label: "Número O.S.", kind: "text" },
  { key: "centro_custo_id", label: "Centro de Custo", kind: "choice" },
  { key: "recuperado", label: "Recuperado", kind: "boolean" },
  { key: "externa_ref", label: "Referência O.S.", kind: "text" },
  { key: "data_inicial", label: "Data Inicial", kind: "date" },
  { key: "data_final", label: "Data Final", kind: "date" },
  { key: "palavra_chave", label: "Palavra Chave", kind: "text" },
  { key: "workshop_id", label: "Oficina/Autopeças", kind: "choice" },
  { key: "com_pendencia", label: "Com Pendência", kind: "boolean" },
  { key: "store_id", label: "Loja", kind: "choice" },
  { key: "plate", label: "Placa Veículo / Prefixo", kind: "text" },
  { key: "montadora", label: "Montadora", kind: "choice" },
  { key: "modelo", label: "Modelo", kind: "choice" },
  { key: "contrato", label: "Contrato", kind: "text" },
  { key: "info_pagamento", label: "Informação de Pagamento", kind: "choice" },
  { key: "peca", label: "Peça (estoque)", kind: "choice" },
  { key: "categoria_veiculo", label: "Categoria Veículo", kind: "choice" },
  { key: "cliente", label: "Cliente", kind: "choice" },
  { key: "tipo_atendimento", label: "Tipo Atendimento", kind: "choice" },
  { key: "mecanico", label: "Mecânico", kind: "choice" },
  { key: "classificacao", label: "Classificação Serviço", kind: "choice" },
];

/** Verifica se algum filtro está ativo. */
export function hasOsFilters(filters: OsFilters): boolean {
  return Object.values(filters).some((v) => v !== "");
}

/** Conta quantos filtros estão ativos. */
export function activeOsFilterCount(filters: OsFilters): number {
  return Object.values(filters).filter((v) => v !== "").length;
}

/** Reseta todos os filtros. */
export function resetOsFilters(): OsFilters {
  return { ...emptyOsFilters };
}

/** Atualiza um campo de filtro. */
export function setOsFilter<K extends keyof OsFilters>(filters: OsFilters, key: K, value: OsFilters[K]): OsFilters {
  return { ...filters, [key]: value };
}

/** Converte filtros frontend para jsonb compatível com RPC search_ordens_servico. */
export function osFiltersToRpc(filters: OsFilters): Record<string, string> {
  const f = filters as any;
  const rpc: Record<string, string> = {};
  if (f.status_id) rpc.status_id = f.status_id;
  if (f.tipo_id) rpc.tipo_id = f.tipo_id;
  if (f.numero) rpc.numero = f.numero;
  if (f.centro_custo_id) rpc.centro_custo_id = f.centro_custo_id;
  if (f.recuperado) rpc.recuperado = f.recuperado;
  if (f.externa_ref) rpc.externa_ref = f.externa_ref;
  if (f.data_inicial) rpc.data_inicial = f.data_inicial;
  if (f.data_final) rpc.data_final = f.data_final;
  if (f.palavra_chave) rpc.palavra_chave = f.palavra_chave;
  if (f.workshop_id) rpc.workshop_id = f.workshop_id;
  if (f.com_pendencia) rpc.com_pendencia = f.com_pendencia;
  if (f.store_id) rpc.store_id = f.store_id;
  if (f.plate) rpc.plate = f.plate;
  if (f.tipo_atendimento) rpc.tipo_atendimento = f.tipo_atendimento;
  return rpc;
}

/**
 * Filtra itens client-side (para quando os dados já estão carregados).
 * Usa mesma lógica de matchesAdvanced do advanced-filter.ts.
 */
export function matchesOsFilter(item: OsListItem, filters: OsFilters): boolean {
  if (filters['status_id'] && String(item.status_id) !== filters['status_id']) return false;
  if (filters['tipo_id'] && String(item.tipo_id) !== filters['tipo_id']) return false;
  if (filters['numero'] && !String(item.numero).includes(filters['numero'])) return false;
  if (filters['centro_custo_id'] && item.centro_custo_id !== filters['centro_custo_id']) return false;
  if (filters['recuperado']) {
    const want = filters['recuperado'] === "true";
    if ((item.recuperado ?? false) !== want) return false;
  }
  if (filters['externa_ref'] && !foldKey(item.externa_ref).includes(foldKey(filters['externa_ref']))) return false;
  if (filters['palavra_chave']) {
    const needle = foldKey(filters['palavra_chave']);
    const haystack = foldKey(`${item.plate} ${item.obs1 ?? ""} ${item.obs2 ?? ""} ${item.condutor_nome ?? ""}`);
    if (!haystack.includes(needle)) return false;
  }
  if (filters['workshop_id'] && item.workshop_id !== filters['workshop_id']) return false;
  if (filters['com_pendencia']) {
    const want = filters['com_pendencia'] === "true";
    if (item.pendencia !== want) return false;
  }
  if (filters['store_id'] && String(item.store_id) !== filters['store_id']) return false;
  if (filters['plate'] && !foldKey(item.plate).includes(foldKey(filters['plate']))) return false;
  if (filters['tipo_atendimento'] && item.tipo_atendimento !== filters['tipo_atendimento']) return false;
  return true;
}

/** Opções de filtro "Recuperado". */
export const RECUPERADO_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

/** Opções de filtro "Com Pendência". */
export const PENDENCIA_OPTIONS = [
  { value: "true", label: "Sim" },
  { value: "false", label: "Não" },
];

/** Opções de tipo de atendimento. */
export const TIPO_ATENDIMENTO_OPTIONS = [
  { value: "P", label: "Programado" },
  { value: "E", label: "Emergência" },
  { value: "N", label: "Normal" },
  { value: "D", label: "Retorno" },
];