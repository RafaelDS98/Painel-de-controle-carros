// Tipos TypeScript para o módulo de Ordens de Serviço.

/** Status da O.S. (código SGLOC). */
export type OsStatusCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Tipo de atendimento. */
export type TipoAtendimento = "P" | "E" | "N" | "D";

/** Aprovação de item. */
export type ItemApproval = "Pendente" | "Autorizado" | "Negado";

/** Tipo de item. */
export type ItemType = "service" | "part";

/** Status de pagamento. */
export type PaymentStatus = "Não Lançado" | "A vencer" | "Vencido" | "Pago";

/** Autorização do cliente. */
export type ClientAuthorization = "Sim" | "Não" | "Pendente";

/** Execução. */
export type ExecutionStatus = "S" | "A" | "N";

/** Registro de tipo de O.S. */
export interface OsTipo {
  id: number;
  code: string;
  label: string;
  active: boolean;
  sort_order: number;
}

/** Registro de status de O.S. */
export interface OsStatus {
  id: number;
  code: string;
  label: string;
  color: string;
  allows_finalize: boolean;
  sort_order: number;
}

/** Centro de custo. */
export interface CentroCusto {
  id: string;
  code: string;
  name: string;
  sgloc_id: number | null;
  active: boolean;
}

/** Posição operacional. */
export interface PosicaoOperacional {
  id: string;
  code: string;
  label: string;
  is_initial: boolean;
  is_final: boolean;
  active: boolean;
}

/** Classificação de serviço. */
export interface ClassificacaoServico {
  id: string;
  name: string;
  active: boolean;
}

/** Conta orçamentária. */
export interface ContaOrcamentaria {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

/** Autorizador. */
export interface OsAutorizador {
  user_id: string;
  is_default: boolean;
}

/** Configuração completa retornada por os_config_list(). */
export interface OsConfig {
  tipos: OsTipo[];
  status: OsStatus[];
  centros_custo: CentroCusto[];
  posicoes: PosicaoOperacional[];
  classificacoes: ClassificacaoServico[];
  contas: ContaOrcamentaria[];
  autorizadores: OsAutorizador[];
}

/** Item da O.S. */
export interface OsItem {
  id: string;
  os_id: string;
  approval: ItemApproval;
  service_code: string | null;
  part_code: string | null;
  description: string;
  qty: number;
  unit_price: number;
  total: number;
  item_type: ItemType;
  budget_account: string | null;
  mechanic_name: string | null;
  classification: string | null;
  requester: string | null;
  authorizer: string | null;
  observation: string | null;
  movement_date: string | null;
  created_at: string;
  updated_at: string;
}

/** Observação do cliente. */
export interface OsObservation {
  id: string;
  os_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

/** Pagamento. */
export interface OsPayment {
  id: string;
  os_id: string;
  conta_orcamentaria_id: string | null;
  fornecedor: string | null;
  qtd_parcelas: number;
  intervalo_dias: number;
  valor_total: number;
  forma_pagamento: string | null;
  emissao: string | null;
  primeiro_vencimento: string | null;
  dia_pagamento: number | null;
  documento: string | null;
  status_pagamento: PaymentStatus;
  aceito: boolean;
  aceito_por: string | null;
  aceito_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Registro principal da O.S. (lista). */
export interface OsListItem {
  id: string;
  numero: number;
  plate: string;
  km: number | null;
  opened_at: string;
  store_id: number | null;
  workshop_id: string | null;
  status_id: number;
  tipo_id: number;
  centro_custo_id: string | null;
  hora: string | null;
  tanque_inicial: string | null;
  gnv_inicial: string | null;
  posicao_inicial: string | null;
  tipo_atendimento: TipoAtendimento;
  contrato_id: number | null;
  condutor_nome: string | null;
  condutor_contato: string | null;
  nf: string | null;
  recuperado: boolean | null;
  externa_ref: string | null;
  obs1: string | null;
  obs2: string | null;
  previsao_conclusao: string | null;
  pagamento_metodo: string | null;
  solicitante: string | null;
  autorizacao: string | null;
  pendencia: boolean;
  pendencia_desc: string | null;
  executado: ExecutionStatus | null;
  autorizado_cliente: ClientAuthorization | null;
  closed_at: string | null;
  km_final: number | null;
  tanque_final: string | null;
  gnv_final: string | null;
  posicao_final: string | null;
  total_servico: number;
  total_estoque: number;
  total_compras: number;
  total_os: number;
  appointment_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  // Joins from search query
  status_label: string;
  status_color: string;
  tipo_label: string;
  workshop_name: string | null;
  centro_custo_name: string | null;
  store_code: string | null;
}

/** Detalhe completo da O.S. */
export interface OsDetail {
  os: OsListItem;
  items: OsItem[];
  observations: OsObservation[];
  payments: OsPayment[];
}

/** Filtros de busca. */
export interface OsFilters {
  status_id: string;
  tipo_id: string;
  numero: string;
  centro_custo_id: string;
  recuperado: string;
  externa_ref: string;
  data_inicial: string;
  data_final: string;
  palavra_chave: string;
  workshop_id: string;
  com_pendencia: string;
  store_id: string;
  plate: string;
  montadora: string;
  modelo: string;
  contrato: string;
  info_pagamento: string;
  peca: string;
  categoria_veiculo: string;
  cliente: string;
  tipo_atendimento: string;
  mecanico: string;
  classificacao: string;
}

/** Resultado da busca paginada. */
export interface OsSearchResult {
  rows: OsListItem[];
  total: number;
}

/** Campos editáveis via os_update. */
export interface OsUpdateFields {
  plate?: string;
  km?: number | null;
  store_id?: number | null;
  workshop_id?: string | null;
  tipo_id?: number;
  centro_custo_id?: string | null;
  tipo_atendimento?: TipoAtendimento;
  hora?: string | null;
  tanque_inicial?: string | null;
  gnv_inicial?: string | null;
  posicao_inicial?: string | null;
  contrato_id?: number | null;
  condutor_nome?: string | null;
  condutor_contato?: string | null;
  nf?: string | null;
  recuperado?: boolean | null;
  externa_ref?: string | null;
  obs1?: string | null;
  obs2?: string | null;
  previsao_conclusao?: string | null;
  pagamento_metodo?: string | null;
  solicitante?: string | null;
  autorizacao?: string | null;
  pendencia?: boolean;
  pendencia_desc?: string | null;
  executado?: ExecutionStatus | null;
  autorizado_cliente?: ClientAuthorization | null;
}

/** Campos para criar item. */
export interface OsItemCreate {
  os_id: string;
  description: string;
  qty: number;
  unit_price: number;
  item_type: ItemType;
  service_code?: string | null;
  part_code?: string | null;
  budget_account?: string | null;
  mechanic_name?: string | null;
  classification?: string | null;
  requester?: string | null;
  authorizer?: string | null;
  observation?: string | null;
  movement_date?: string | null;
}

/** Campos editáveis de item. */
export interface OsItemUpdateFields {
  approval?: ItemApproval;
  description?: string;
  qty?: number;
  unit_price?: number;
  item_type?: ItemType;
  service_code?: string | null;
  part_code?: string | null;
  budget_account?: string | null;
  mechanic_name?: string | null;
  classification?: string | null;
  requester?: string | null;
  authorizer?: string | null;
  observation?: string | null;
  movement_date?: string | null;
}

/** Filtros vazios padrão. */
export const emptyOsFilters: OsFilters = {
  status_id: "",
  tipo_id: "",
  numero: "",
  centro_custo_id: "",
  recuperado: "",
  externa_ref: "",
  data_inicial: "",
  data_final: "",
  palavra_chave: "",
  workshop_id: "",
  com_pendencia: "",
  store_id: "",
  plate: "",
  montadora: "",
  modelo: "",
  contrato: "",
  info_pagamento: "",
  peca: "",
  categoria_veiculo: "",
  cliente: "",
  tipo_atendimento: "",
  mecanico: "",
  classificacao: "",
};

/** Labels dos tipos de atendimento. */
export const TIPO_ATENDIMENTO_LABELS: Record<TipoAtendimento, string> = {
  P: "Programado",
  E: "Emergência",
  N: "Normal",
  D: "Retorno",
};

/** Labels de execução. */
export const EXECUTADO_LABELS: Record<ExecutionStatus, string> = {
  S: "Sim",
  A: "Aguardando",
  N: "Não",
};

/** Labels de autorização do cliente. */
export const CLIENT_AUTH_LABELS: Record<ClientAuthorization, string> = {
  Sim: "Sim",
  Não: "Não",
  Pendente: "Pendente",
};

/** Labels de aprovação de item. */
export const APPROVAL_LABELS: Record<ItemApproval, string> = {
  Pendente: "Pendente",
  Autorizado: "Autorizado",
  Negado: "Negado",
};

/** Cores de aprovação de item. */
export const APPROVAL_COLORS: Record<ItemApproval, string> = {
  Pendente: "#f59e0b",
  Autorizado: "#10b981",
  Negado: "#ef4444",
};