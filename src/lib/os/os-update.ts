// Construtor de update para O.S. — mesmo padrão de buildAppointmentUpdate.
// Mapeia campos camelCase do formulário para snake_case do banco.
import type { OsUpdateFields, OsItemUpdateFields } from "./os-types";

/** Mapeamento campo formulário → coluna do banco. */
const fieldColumns: Record<string, string> = {
  plate: "plate",
  km: "km",
  storeId: "store_id",
  workshopId: "workshop_id",
  tipoId: "tipo_id",
  centroCustoId: "centro_custo_id",
  tipoAtendimento: "tipo_atendimento",
  hora: "hora",
  tanqueInicial: "tanque_inicial",
  gnvInicial: "gnv_inicial",
  posicaoInicial: "posicao_inicial",
  contratoId: "contrato_id",
  condutorNome: "condutor_nome",
  condutorContato: "condutor_contato",
  nf: "nf",
  recuperado: "recuperado",
  externaRef: "externa_ref",
  obs1: "obs1",
  obs2: "obs2",
  previsaoConclusao: "previsao_conclusao",
  pagamentoMetodo: "pagamento_metodo",
  solicitante: "solicitante",
  autorizacao: "autorizacao",
  pendencia: "pendencia",
  pendenciaDesc: "pendencia_desc",
  executado: "executado",
  autorizadoCliente: "autorizado_cliente",
};

/** Mapeamento campo item formulário → coluna do banco. */
const itemFieldColumns: Record<string, string> = {
  approval: "approval",
  description: "description",
  qty: "qty",
  unitPrice: "unit_price",
  itemType: "item_type",
  serviceCode: "service_code",
  partCode: "part_code",
  budgetAccount: "budget_account",
  mechanicName: "mechanic_name",
  classification: "classification",
  requester: "requester",
  authorizer: "authorizer",
  observation: "observation",
  movementDate: "movement_date",
};

/**
 * Constrói objeto de update para RPC os_update a partir das mudanças do formulário.
 * Só inclui campos que efetivamente mudaram. Retorna null se nada mudou.
 */
export function buildOsUpdate(
  changes: Record<string, unknown>,
  current: Record<string, unknown>,
): OsUpdateFields | null {
  const update: Record<string, unknown> = {};
  let hasChanges = false;

  for (const [formKey, dbCol] of Object.entries(fieldColumns)) {
    if (!(formKey in changes)) continue;
    const newVal = changes[formKey];
    const oldVal = current[dbCol] ?? current[formKey];
    if (String(newVal ?? "") !== String(oldVal ?? "")) {
      update[dbCol] = newVal === "" ? null : newVal;
      hasChanges = true;
    }
  }

  return hasChanges ? (update as OsUpdateFields) : null;
}

/**
 * Constrói objeto de update para RPC os_item_update.
 */
export function buildOsItemUpdate(
  changes: Record<string, unknown>,
  current: Record<string, unknown>,
): OsItemUpdateFields | null {
  const update: Record<string, unknown> = {};
  let hasChanges = false;

  for (const [formKey, dbCol] of Object.entries(itemFieldColumns)) {
    if (!(formKey in changes)) continue;
    const newVal = changes[formKey];
    const oldVal = current[dbCol] ?? current[formKey];
    if (String(newVal ?? "") !== String(oldVal ?? "")) {
      update[dbCol] = newVal === "" ? null : newVal;
      hasChanges = true;
    }
  }

  return hasChanges ? (update as OsItemUpdateFields) : null;
}

/** Converte OsUpdateFields para jsonb compatível com a RPC os_update. */
export function osUpdateToJsonb(fields: OsUpdateFields): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/** Converte OsItemUpdateFields para jsonb compatível com a RPC os_item_update. */
export function osItemUpdateToJsonb(fields: OsItemUpdateFields): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}