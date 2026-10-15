// Funções puras de exibição, formatação e segurança para Ordens de Serviço.
// Mesmo padrão de agenda-safety.ts.
import { dash, foldKey, guardFormula } from "../agenda-safety";
import { safeText, normalizePlate } from "../normalize";
import type { OsListItem, OsItem, OsFilters } from "./os-types";
import { TIPO_ATENDIMENTO_LABELS, EXECUTADO_LABELS, CLIENT_AUTH_LABELS, APPROVAL_LABELS, APPROVAL_COLORS } from "./os-types";
import { STATUS_LABELS, STATUS_COLORS } from "./os-status";

/** Exibe valor ou "—" se vazio. */
export { dash };

/** Formata placa para exibição (ABC-1234 ou ABC1D23). */
export function displayPlate(plate: unknown): string {
  const p = normalizePlate(plate);
  if (p.length === 7) return `${p.slice(0, 3)}-${p.slice(3)}`;
  return p || dash(plate);
}

/** Formata número da O.S. com padding. */
export function displayOsNumber(numero: unknown): string {
  const n = Number(numero);
  return Number.isFinite(n) && n > 0 ? String(n).padStart(6, "0") : dash(numero);
}

/** Label do status por código. */
export function statusLabel(statusId: number): string {
  return STATUS_LABELS[statusId] ?? `Status ${statusId}`;
}

/** Cor do status por código. */
export function statusColor(statusId: number): string {
  return STATUS_COLORS[statusId] ?? "#6b7280";
}

/** Label do tipo de atendimento. */
export function tipoAtendimentoDisplay(code: string): string {
  return TIPO_ATENDIMENTO_LABELS[code as keyof typeof TIPO_ATENDIMENTO_LABELS] ?? code;
}

/** Label de execução. */
export function executadoDisplay(code: string | null): string {
  if (!code) return dash(null);
  return EXECUTADO_LABELS[code as keyof typeof EXECUTADO_LABELS] ?? code;
}

/** Label de autorização do cliente. */
export function clientAuthDisplay(code: string | null): string {
  if (!code) return dash(null);
  return CLIENT_AUTH_LABELS[code as keyof typeof CLIENT_AUTH_LABELS] ?? code;
}

/** Label de aprovação de item. */
export function approvalDisplay(approval: string): string {
  return APPROVAL_LABELS[approval as keyof typeof APPROVAL_LABELS] ?? approval;
}

/** Cor de aprovação de item. */
export function approvalColor(approval: string): string {
  return APPROVAL_COLORS[approval as keyof typeof APPROVAL_COLORS] ?? "#6b7280";
}

/** Formata valor monetário. */
export function formatMoney(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return dash(value);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formata KM com separador de milhar. */
export function formatKm(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return dash(value);
  return n.toLocaleString("pt-BR");
}

/** Resumo curto da O.S. para tooltips e listas compactas. */
export function osSummary(os: OsListItem): string {
  const parts = [
    `O.S. ${displayOsNumber(os.numero)}`,
    displayPlate(os.plate),
    os.status_label,
  ];
  if (os.workshop_name) parts.push(os.workshop_name);
  return parts.join(" · ");
}

/** Verifica se a O.S. está aberta (não finalizada nem cancelada). */
export function isOpen(os: OsListItem): boolean {
  return os.status_id !== 3 && os.status_id !== 7;
}

/** Verifica se a O.S. pode ser editada (não arquivada). */
export function isEditable(os: OsListItem): boolean {
  return !os.archived_at;
}

/** Totais formatados para exibição no painel lateral. */
export function osTotalsDisplay(os: OsListItem): { label: string; value: string }[] {
  return [
    { label: "Total Serviço", value: formatMoney(os.total_servico) },
    { label: "Total Estoque", value: formatMoney(os.total_estoque) },
    { label: "Total Compras", value: formatMoney(os.total_compras) },
    { label: "Total O.S.", value: formatMoney(os.total_os) },
  ];
}

/** Agrupa itens por tipo (serviço/peça) com subtotais. */
export function groupItemsByType(items: OsItem[]): { service: OsItem[]; part: OsItem[]; serviceTotal: number; partTotal: number } {
  const service = items.filter((i) => i.item_type === "service");
  const part = items.filter((i) => i.item_type === "part");
  const serviceTotal = service.reduce((sum, i) => sum + i.total, 0);
  const partTotal = part.reduce((sum, i) => sum + i.total, 0);
  return { service, part, serviceTotal, partTotal };
}

/** Conta itens por aprovação. */
export function countByApproval(items: OsItem[]): { pending: number; authorized: number; denied: number } {
  return {
    pending: items.filter((i) => i.approval === "Pendente").length,
    authorized: items.filter((i) => i.approval === "Autorizado").length,
    denied: items.filter((i) => i.approval === "Negado").length,
  };
}