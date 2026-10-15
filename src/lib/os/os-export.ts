// Headers e rows para exportação CSV/XLSX de Ordens de Serviço — colunas compatíveis com SGLOC.
import { dash, guardFormula } from "../agenda-safety";
import { formatDateBR, formatDateTimeBR } from "../agenda-safety";
import type { OsListItem } from "./os-types";
import { TIPO_ATENDIMENTO_LABELS, EXECUTADO_LABELS, CLIENT_AUTH_LABELS } from "./os-types";

/** Cabeçalhos de exportação — mesmos nomes do SGLOC para reconciliação. */
export const OS_EXPORT_HEADERS = [
  "Status", "Tipo", "Nº", "Tipo Atendimento", "Data Abertura", "Data Fechamento",
  "Placa", "Modelo", "KM", "Pos. Op.", "Oficina", "Centro Custo", "Nota Fiscal",
  "Total O.S.", "Total Compras", "Total O.S.+Compras", "Total Estoque", "Total Serviço",
  "Contrato", "Condutor", "Recuperado", "Executado", "Autorizado Cliente",
  "Ref. Externa", "Pendência", "Previsão Conclusão",
];

/** Converte lista de O.S. em rows para CSV/XLSX. */
export function osExportRows(items: OsListItem[]): Record<string, string>[] {
  return items.map((os) => ({
    "Status": os.status_label ?? "",
    "Tipo": os.tipo_label ?? "",
    "Nº": String(os.numero),
    "Tipo Atendimento": TIPO_ATENDIMENTO_LABELS[os.tipo_atendimento] ?? os.tipo_atendimento,
    "Data Abertura": formatDateBR(os.opened_at),
    "Data Fechamento": os.closed_at ? formatDateBR(os.closed_at) : "",
    "Placa": guardFormula(os.plate),
    "Modelo": "",
    "KM": os.km != null ? String(os.km) : "",
    "Pos. Op.": os.posicao_inicial ?? "",
    "Oficina": os.workshop_name ?? "",
    "Centro Custo": os.centro_custo_name ?? "",
    "Nota Fiscal": guardFormula(os.nf ?? ""),
    "Total O.S.": formatCurrency(os.total_os),
    "Total Compras": formatCurrency(os.total_compras),
    "Total O.S.+Compras": formatCurrency(os.total_os + os.total_compras),
    "Total Estoque": formatCurrency(os.total_estoque),
    "Total Serviço": formatCurrency(os.total_servico),
    "Contrato": os.contrato_id != null ? String(os.contrato_id) : "",
    "Condutor": guardFormula(os.condutor_nome ?? ""),
    "Recuperado": os.recuperado ? "Sim" : "Não",
    "Executado": os.executado ? (EXECUTADO_LABELS[os.executado] ?? os.executado) : "",
    "Autorizado Cliente": os.autorizado_cliente ? (CLIENT_AUTH_LABELS[os.autorizado_cliente] ?? os.autorizado_cliente) : "",
    "Ref. Externa": guardFormula(os.externa_ref ?? ""),
    "Pendência": os.pendencia ? "Sim" : "Não",
    "Previsão Conclusão": os.previsao_conclusao ? formatDateBR(os.previsao_conclusao) : "",
  }));
}

/** Formata valor numérico como moeda brasileira. */
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Cabeçalhos para exportação de itens da O.S. */
export const OS_ITEMS_EXPORT_HEADERS = [
  "Aprovação", "Cód. Serviço", "Cód. Peça", "Descrição", "Qtd", "Valor Unit.", "Total",
  "Tipo", "Conta Orçamentária", "Mecânico", "Classificação", "Solicitante", "Autorizador",
  "Observação", "Data Movimentação",
];

/** Converte itens em rows para exportação. */
export function osItemsExportRows(items: Array<{
  approval: string; service_code: string | null; part_code: string | null;
  description: string; qty: number; unit_price: number; total: number;
  item_type: string; budget_account: string | null; mechanic_name: string | null;
  classification: string | null; requester: string | null; authorizer: string | null;
  observation: string | null; movement_date: string | null;
}>): Record<string, string>[] {
  return items.map((item) => ({
    "Aprovação": item.approval,
    "Cód. Serviço": guardFormula(item.service_code ?? ""),
    "Cód. Peça": guardFormula(item.part_code ?? ""),
    "Descrição": guardFormula(item.description),
    "Qtd": String(item.qty),
    "Valor Unit.": formatCurrency(item.unit_price),
    "Total": formatCurrency(item.total),
    "Tipo": item.item_type === "service" ? "Serviço" : "Peça",
    "Conta Orçamentária": guardFormula(item.budget_account ?? ""),
    "Mecânico": guardFormula(item.mechanic_name ?? ""),
    "Classificação": guardFormula(item.classification ?? ""),
    "Solicitante": guardFormula(item.requester ?? ""),
    "Autorizador": guardFormula(item.authorizer ?? ""),
    "Observação": guardFormula(item.observation ?? ""),
    "Data Movimentação": item.movement_date ? formatDateBR(item.movement_date) : "",
  }));
}