import {
  pgTable,
  serial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  date,
  time,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================================
// ENUMS
// ============================================================

export const osStatusEnum = pgEnum("os_status", [
  "em_cotacao",       // 6
  "aguardando_entrega", // 5
  "para_aprovacao",   // 2
  "aprovada",         // 4
  "em_andamento",     // 1
  "cancelada",        // 3
  "finalizada",       // código a confirmar
]);

export const tipoAtendimentoEnum = pgEnum("tipo_atendimento", [
  "programado",   // P
  "emergencial",  // E
  "normal",       // N
  "devolucao",    // D
]);

export const tanqueEnum = pgEnum("tanque_nivel", [
  "reserva", "1_8", "2_8", "3_8", "4_8", "5_8", "6_8", "7_8", "cheio",
]);

export const gnvEnum = pgEnum("gnv_nivel", ["1", "2", "3", "4"]);

export const aprovacaoItemEnum = pgEnum("aprovacao_item", [
  "pendente", "autorizado", "negado",
]);

export const executadoEnum = pgEnum("executado", ["sim", "em_andamento", "nao"]);

export const autorizadoClienteEnum = pgEnum("autorizado_cliente", [
  "sim", "nao", "pendente",
]);

export const pecaServicoEnum = pgEnum("peca_servico", ["peca", "servico"]);

export const statusPagamentoEnum = pgEnum("status_pagamento", [
  "nao_lancado", "a_vencer", "vencido", "pago",
]);

export const formaPagamentoEnum = pgEnum("forma_pagamento", [
  "cartao_credito", "cartao_debito", "dinheiro", "pix", "boleto",
  "transferencia", "cheque", "cortesia", "outro",
]);

export const statusOrcamentoEnum = pgEnum("status_orcamento", [
  "rascunho", "enviado", "aprovado", "recusado", "expirado",
]);

// ============================================================
// SEQUÊNCIA GLOBAL PARA NUMERAÇÃO OS
// ============================================================

export const sequencias = pgTable("sequencias", {
  nome: varchar("nome", { length: 50 }).primaryKey(),
  valorAtual: integer("valor_atual").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================
// CADASTROS DE APOIO
// ============================================================

// --- Lojas ---
export const lojas = pgTable("lojas", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 200 }).notNull(),
  razaoSocial: varchar("razao_social", { length: 300 }),
  cnpj: varchar("cnpj", { length: 20 }),
  endereco: text("endereco"),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 200 }),
  ativa: boolean("ativa").notNull().default(true),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  sglocIdx: uniqueIndex("lojas_sgloc_id_idx").on(t.sglocId),
}));

// --- Fornecedores ---
export const fornecedores = pgTable("fornecedores", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 300 }).notNull(),
  razaoSocial: varchar("razao_social", { length: 400 }),
  cnpj: varchar("cnpj", { length: 20 }),
  cpf: varchar("cpf", { length: 15 }),
  endereco: text("endereco"),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 200 }),
  contato: varchar("contato", { length: 200 }),
  oficina: boolean("oficina").notNull().default(false),
  pecas: boolean("pecas").notNull().default(false),
  concessionaria: boolean("concessionaria").notNull().default(false),
  ativo: boolean("ativo").notNull().default(true),
  observacoes: text("observacoes"),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  sglocIdx: uniqueIndex("fornecedores_sgloc_id_idx").on(t.sglocId),
  nomeIdx: index("fornecedores_nome_idx").on(t.nome),
}));

// --- Centros de Custo ---
export const centrosCusto = pgTable("centros_custo", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  codigoIdx: uniqueIndex("centros_custo_codigo_idx").on(t.codigo),
  sglocIdx: uniqueIndex("centros_custo_sgloc_id_idx").on(t.sglocId),
}));

// --- Tipos de OS ---
export const tiposOs = pgTable("tipos_os", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  ativo: boolean("ativo").notNull().default(true),
  entraCustoManutVeiculos: boolean("entra_custo_manut_veiculos").notNull().default(true),
  exibeAbasRecebimento: boolean("exibe_abas_recebimento").notNull().default(false),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  sglocIdx: uniqueIndex("tipos_os_sgloc_id_idx").on(t.sglocId),
}));

// --- Classificações de Serviço ---
export const classificacoesServico = pgTable("classificacoes_servico", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 100 }).notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Posições Operacionais ---
export const posicoesOperacionais = pgTable("posicoes_operacionais", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 10 }).notNull(),
  nome: varchar("nome", { length: 100 }).notNull(),
  tipo: varchar("tipo", { length: 20 }).notNull().default("inicial"), // inicial | final
  ativo: boolean("ativo").notNull().default(true),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  codigoIdx: uniqueIndex("posicoes_op_codigo_idx").on(t.codigo),
}));

// --- Contas Orçamentárias ---
export const contasOrcamentarias = pgTable("contas_orcamentarias", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 300 }).notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  codigoIdx: uniqueIndex("contas_orc_codigo_idx").on(t.codigo),
}));

// --- Mecânicos ---
export const mecanicos = pgTable("mecanicos", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 200 }).notNull(),
  especialidade: varchar("especialidade", { length: 100 }),
  ativo: boolean("ativo").notNull().default(true),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Clientes ---
export const clientes = pgTable("clientes", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 300 }).notNull(),
  razaoSocial: varchar("razao_social", { length: 400 }),
  cnpj: varchar("cnpj", { length: 20 }),
  cpf: varchar("cpf", { length: 15 }),
  endereco: text("endereco"),
  cidade: varchar("cidade", { length: 100 }),
  estado: varchar("estado", { length: 2 }),
  telefone: varchar("telefone", { length: 20 }),
  email: varchar("email", { length: 200 }),
  contato: varchar("contato", { length: 200 }),
  ativo: boolean("ativo").notNull().default(true),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  sglocIdx: uniqueIndex("clientes_sgloc_id_idx").on(t.sglocId),
}));

// --- Veículos ---
export const veiculos = pgTable("veiculos", {
  id: serial("id").primaryKey(),
  placa: varchar("placa", { length: 10 }).notNull(),
  prefixo: varchar("prefixo", { length: 20 }),
  chassi: varchar("chassi", { length: 30 }).notNull(),
  montadora: varchar("montadora", { length: 100 }),
  modelo: varchar("modelo", { length: 100 }),
  anoFabricacao: integer("ano_fabricacao"),
  anoModelo: integer("ano_modelo"),
  categoria: varchar("categoria", { length: 50 }),
  grupo: varchar("grupo", { length: 50 }),
  combustivel: varchar("combustivel", { length: 30 }),
  tanqueLitros: numeric("tanque_litros", { precision: 6, scale: 2 }),
  kmAtual: integer("km_atual").default(0),
  status: varchar("status", { length: 30 }).notNull().default("ativo"),
  lojaOperacaoId: integer("loja_operacao_id").references(() => lojas.id),
  lojaProprietariaId: integer("loja_proprietaria_id").references(() => lojas.id),
  estado: varchar("estado", { length: 2 }),
  cor: varchar("cor", { length: 50 }),
  renavam: varchar("renavam", { length: 20 }),
  dataCompra: date("data_compra"),
  observacoes: text("observacoes"),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  placaIdx: uniqueIndex("veiculos_placa_idx").on(t.placa),
  sglocIdx: uniqueIndex("veiculos_sgloc_id_idx").on(t.sglocId),
  montadoraIdx: index("veiculos_montadora_idx").on(t.montadora),
  modeloIdx: index("veiculos_modelo_idx").on(t.modelo),
}));

// --- Contratos ---
export const contratos = pgTable("contratos", {
  id: serial("id").primaryKey(),
  numero: varchar("numero", { length: 50 }).notNull(),
  clienteId: integer("cliente_id").references(() => clientes.id),
  veiculoId: integer("veiculo_id").references(() => veiculos.id),
  dataInicio: date("data_inicio"),
  dataFim: date("data_fim"),
  valorMensal: numeric("valor_mensal", { precision: 12, scale: 2 }),
  status: varchar("status", { length: 30 }).notNull().default("ativo"),
  observacoes: text("observacoes"),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  numeroIdx: uniqueIndex("contratos_numero_idx").on(t.numero),
}));

// --- Operadores / Usuários (referência para OS) ---
export const operadores = pgTable("operadores", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 200 }).notNull(),
  email: varchar("email", { length: 200 }),
  telefone: varchar("telefone", { length: 20 }),
  podeAutorizar: boolean("pode_autorizar").notNull().default(false),
  podeAceitar: boolean("pode_aceitar").notNull().default(false),
  ativo: boolean("ativo").notNull().default(true),
  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// ORDEM DE SERVIÇO (TABELA PRINCIPAL)
// ============================================================

export const ordensServico = pgTable("ordens_servico", {
  id: serial("id").primaryKey(),
  numero: integer("numero").notNull(),

  // Campos obrigatórios
  veiculoId: integer("veiculo_id").notNull().references(() => veiculos.id),
  km: integer("km").notNull(),
  data: date("data").notNull(),
  lojaId: integer("loja_id").notNull().references(() => lojas.id),
  fornecedorId: integer("fornecedor_id").notNull().references(() => fornecedores.id),
  status: osStatusEnum("status").notNull().default("para_aprovacao"),
  tipoOsId: integer("tipo_os_id").notNull().references(() => tiposOs.id),
  centroCustoId: integer("centro_custo_id").notNull().references(() => centrosCusto.id),

  // Campos opcionais - abertura
  hora: time("hora"),
  tanqueInicial: tanqueEnum("tanque_inicial"),
  gnvInicial: gnvEnum("gnv_inicial"),
  posicaoInicialId: integer("posicao_inicial_id").references(() => posicoesOperacionais.id),
  tipoAtendimento: tipoAtendimentoEnum("tipo_atendimento"),
  contratoId: integer("contrato_id").references(() => contratos.id),
  operadorRecepcionouId: integer("operador_recepcionou_id").references(() => operadores.id),
  condutorNome: varchar("condutor_nome", { length: 200 }),
  condutorContato: varchar("condutor_contato", { length: 100 }),
  notaFiscal: varchar("nota_fiscal", { length: 50 }),
  recuperado: boolean("recuperado").default(false),
  referenciaOsExterna: varchar("referencia_os_externa", { length: 50 }),
  obs1: text("obs1"),
  obs2: text("obs2"),
  previsaoConclusao: date("previsao_conclusao"),
  formaPagamento: formaPagamentoEnum("forma_pagamento"),
  solicitanteId: integer("solicitante_id").references(() => operadores.id),
  autorizadorId: integer("autorizador_id").references(() => operadores.id),
  pendencia: boolean("pendencia").default(false),
  descPendencia: text("desc_pendencia"),
  agendarProximaOs: boolean("agendar_proxima_os").default(false),
  executado: executadoEnum("executado").default("nao"),
  autorizadoCliente: autorizadoClienteEnum("autorizado_cliente").default("pendente"),

  // Campos de finalização
  dataFinal: date("data_final"),
  horaFinal: time("hora_final"),
  kmFinal: integer("km_final"),
  tanqueFinal: tanqueEnum("tanque_final"),
  gnvFinal: gnvEnum("gnv_final"),
  posicaoFinalId: integer("posicao_final_id").references(() => posicoesOperacionais.id),

  // Status pagamento (derivado do financeiro)
  statusPagamento: statusPagamentoEnum("status_pagamento").default("nao_lancado"),

  // Totais (calculados)
  totalOs: numeric("total_os", { precision: 12, scale: 2 }).default("0"),
  totalServico: numeric("total_servico", { precision: 12, scale: 2 }).default("0"),
  totalEstoque: numeric("total_estoque", { precision: 12, scale: 2 }).default("0"),
  totalCompras: numeric("total_compras", { precision: 12, scale: 2 }).default("0"),

  // Sync SGLOC
  sglocId: integer("sgloc_id"),
  sglocSyncedAt: timestamp("sgloc_synced_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  numeroIdx: uniqueIndex("os_numero_idx").on(t.numero),
  statusIdx: index("os_status_idx").on(t.status),
  dataIdx: index("os_data_idx").on(t.data),
  veiculoIdx: index("os_veiculo_idx").on(t.veiculoId),
  lojaIdx: index("os_loja_idx").on(t.lojaId),
  fornecedorIdx: index("os_fornecedor_idx").on(t.fornecedorId),
  tipoOsIdx: index("os_tipo_os_idx").on(t.tipoOsId),
  centroCustoIdx: index("os_centro_custo_idx").on(t.centroCustoId),
  sglocIdx: uniqueIndex("os_sgloc_id_idx").on(t.sglocId),
}));

// ============================================================
// ITENS DA OS (Serviços Efetuados)
// ============================================================

export const osItens = pgTable("os_itens", {
  id: serial("id").primaryKey(),
  osId: integer("os_id").notNull().references(() => ordensServico.id, { onDelete: "cascade" }),

  aprovacao: aprovacaoItemEnum("aprovacao").notNull().default("pendente"),
  codServico: varchar("cod_servico", { length: 30 }),
  codPeca: varchar("cod_peca", { length: 30 }),
  descricao: text("descricao").notNull(),
  quantidade: numeric("quantidade", { precision: 10, scale: 2 }).notNull().default("1"),
  valorUnitario: numeric("valor_unitario", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  pecaServico: pecaServicoEnum("peca_servico").notNull().default("servico"),
  contaOrcamentariaId: integer("conta_orcamentaria_id").references(() => contasOrcamentarias.id),
  mecanicoId: integer("mecanico_id").references(() => mecanicos.id),
  laudo: text("laudo"),
  classificacaoServicoId: integer("classificacao_servico_id").references(() => classificacoesServico.id),
  solicitanteId: integer("solicitante_id").references(() => operadores.id),
  autorizadorId: integer("autorizador_id").references(() => operadores.id),
  dataMovimentacao: date("data_movimentacao"),
  observacao: text("observacao"),
  ultimaOcorrencia: text("ultima_ocorrencia"),
  servicoProgramado: boolean("servico_programado").default(false),

  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  osIdx: index("os_itens_os_idx").on(t.osId),
  aprovacaoIdx: index("os_itens_aprovacao_idx").on(t.aprovacao),
}));

// ============================================================
// PAGAMENTOS DA OS
// ============================================================

export const osPagamentos = pgTable("os_pagamentos", {
  id: serial("id").primaryKey(),
  osId: integer("os_id").notNull().references(() => ordensServico.id, { onDelete: "cascade" }),

  contaOrcamentariaId: integer("conta_orcamentaria_id").references(() => contasOrcamentarias.id),
  fornecedorId: integer("fornecedor_id").references(() => fornecedores.id),
  quantParcelas: integer("quant_parcelas").default(1),
  intervaloDias: integer("intervalo_dias").default(0),
  valorTotal: numeric("valor_total", { precision: 12, scale: 2 }).notNull().default("0"),
  formaPagamento: formaPagamentoEnum("forma_pagamento"),
  emissao: date("emissao"),
  primeiroVencimento: date("primeiro_vencimento"),
  diaPagamento: integer("dia_pagamento"),
  documento: varchar("documento", { length: 50 }),
  aceito: boolean("aceito").default(false),
  aceitoPor: integer("aceito_por").references(() => operadores.id),
  aceitoEm: timestamp("aceito_em"),

  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  osIdx: index("os_pagamentos_os_idx").on(t.osId),
}));

// ============================================================
// COMPRAS VINCULADAS
// ============================================================

export const osCompras = pgTable("os_compras", {
  id: serial("id").primaryKey(),
  osId: integer("os_id").notNull().references(() => ordensServico.id, { onDelete: "cascade" }),

  numeroCompra: varchar("numero_compra", { length: 50 }).notNull(),
  valor: numeric("valor", { precision: 12, scale: 2 }).default("0"),
  descricao: text("descricao"),
  data: date("data"),

  sglocId: integer("sgloc_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  osIdx: index("os_compras_os_idx").on(t.osId),
  numeroIdx: index("os_compras_numero_idx").on(t.numeroCompra),
}));

// ============================================================
// COTAÇÕES (até 3 fornecedores por item)
// ============================================================

export const osCotacoes = pgTable("os_cotacoes", {
  id: serial("id").primaryKey(),
  osItemId: integer("os_item_id").notNull().references(() => osItens.id, { onDelete: "cascade" }),

  fornecedorId: integer("fornecedor_id").notNull().references(() => fornecedores.id),
  valorUnitario: numeric("valor_unitario", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  prazoPagamento: varchar("prazo_pagamento", { length: 50 }),
  observacao: text("observacao"),
  selecionada: boolean("selecionada").default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  itemIdx: index("os_cotacoes_item_idx").on(t.osItemId),
}));

// ============================================================
// OBSERVAÇÕES DO CLIENTE
// ============================================================

export const osObservacoesCliente = pgTable("os_observacoes_cliente", {
  id: serial("id").primaryKey(),
  osId: integer("os_id").notNull().references(() => ordensServico.id, { onDelete: "cascade" }),

  descricao: text("descricao").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  osIdx: index("os_obs_cliente_os_idx").on(t.osId),
}));

// ============================================================
// AVALIAÇÃO DO FORNECEDOR
// ============================================================

export const osAvaliacoes = pgTable("os_avaliacoes", {
  id: serial("id").primaryKey(),
  osId: integer("os_id").notNull().references(() => ordensServico.id, { onDelete: "cascade" }),

  fornecedorId: integer("fornecedor_id").references(() => fornecedores.id),
  controleQualidade: numeric("controle_qualidade", { precision: 3, scale: 1 }),
  mercadoLivre: numeric("mercado_livre", { precision: 3, scale: 1 }),
  pontualidade: numeric("pontualidade", { precision: 3, scale: 1 }),
  preco: numeric("preco", { precision: 3, scale: 1 }),
  observacao: text("observacao"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  osIdx: index("os_avaliacoes_os_idx").on(t.osId),
}));

// ============================================================
// ORÇAMENTO DO CLIENTE
// ============================================================

export const osOrcamentosCliente = pgTable("os_orcamentos_cliente", {
  id: serial("id").primaryKey(),
  osId: integer("os_id").notNull().references(() => ordensServico.id, { onDelete: "cascade" }),

  descricao: text("descricao").notNull(),
  quantidade: numeric("quantidade", { precision: 10, scale: 2 }).default("1"),
  valor: numeric("valor", { precision: 12, scale: 2 }).default("0"),
  imprimirNoOrcamento: boolean("imprimir_no_orcamento").default(true),
  formacaoPrecoTaxa: numeric("formacao_preco_taxa", { precision: 5, scale: 2 }).default("0"),
  desconto: numeric("desconto", { precision: 12, scale: 2 }).default("0"),
  taxaServico: numeric("taxa_servico", { precision: 12, scale: 2 }).default("0"),
  emissao: date("emissao"),
  status: statusOrcamentoEnum("status").default("rascunho"),
  negociacaoCliente: text("negociacao_cliente"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  osIdx: index("os_orcamentos_os_idx").on(t.osId),
}));

// ============================================================
// ANEXOS
// ============================================================

export const osAnexos = pgTable("os_anexos", {
  id: serial("id").primaryKey(),
  osId: integer("os_id").notNull().references(() => ordensServico.id, { onDelete: "cascade" }),

  nomeArquivo: varchar("nome_arquivo", { length: 300 }).notNull(),
  url: text("url").notNull(),
  tipoMime: varchar("tipo_mime", { length: 100 }),
  tamanhoBytes: integer("tamanho_bytes"),
  descricao: text("descricao"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  osIdx: index("os_anexos_os_idx").on(t.osId),
}));

// ============================================================
// MECÂNICOS DA OS (vínculo muitos-para-muitos)
// ============================================================

export const osMecanicos = pgTable("os_mecanicos", {
  osId: integer("os_id").notNull().references(() => ordensServico.id, { onDelete: "cascade" }),
  mecanicoId: integer("mecanico_id").notNull().references(() => mecanicos.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.osId, t.mecanicoId] }),
}));

// ============================================================
// RELAÇÕES
// ============================================================

export const ordensServicoRelations = relations(ordensServico, ({ one, many }) => ({
  veiculo: one(veiculos, { fields: [ordensServico.veiculoId], references: [veiculos.id] }),
  loja: one(lojas, { fields: [ordensServico.lojaId], references: [lojas.id] }),
  fornecedor: one(fornecedores, { fields: [ordensServico.fornecedorId], references: [fornecedores.id] }),
  tipoOs: one(tiposOs, { fields: [ordensServico.tipoOsId], references: [tiposOs.id] }),
  centroCusto: one(centrosCusto, { fields: [ordensServico.centroCustoId], references: [centrosCusto.id] }),
  posicaoInicial: one(posicoesOperacionais, { fields: [ordensServico.posicaoInicialId], references: [posicoesOperacionais.id], relationName: "posicaoInicial" }),
  posicaoFinal: one(posicoesOperacionais, { fields: [ordensServico.posicaoFinalId], references: [posicoesOperacionais.id], relationName: "posicaoFinal" }),
  contrato: one(contratos, { fields: [ordensServico.contratoId], references: [contratos.id] }),
  operadorRecepcionou: one(operadores, { fields: [ordensServico.operadorRecepcionouId], references: [operadores.id], relationName: "recepcionou" }),
  solicitante: one(operadores, { fields: [ordensServico.solicitanteId], references: [operadores.id], relationName: "solicitante" }),
  autorizador: one(operadores, { fields: [ordensServico.autorizadorId], references: [operadores.id], relationName: "autorizador" }),
  itens: many(osItens),
  pagamentos: many(osPagamentos),
  compras: many(osCompras),
  observacoesCliente: many(osObservacoesCliente),
  avaliacoes: many(osAvaliacoes),
  orcamentosCliente: many(osOrcamentosCliente),
  anexos: many(osAnexos),
  mecanicos: many(osMecanicos),
}));

export const osItensRelations = relations(osItens, ({ one, many }) => ({
  os: one(ordensServico, { fields: [osItens.osId], references: [ordensServico.id] }),
  contaOrcamentaria: one(contasOrcamentarias, { fields: [osItens.contaOrcamentariaId], references: [contasOrcamentarias.id] }),
  mecanico: one(mecanicos, { fields: [osItens.mecanicoId], references: [mecanicos.id] }),
  classificacaoServico: one(classificacoesServico, { fields: [osItens.classificacaoServicoId], references: [classificacoesServico.id] }),
  solicitante: one(operadores, { fields: [osItens.solicitanteId], references: [operadores.id], relationName: "itemSolicitante" }),
  autorizador: one(operadores, { fields: [osItens.autorizadorId], references: [operadores.id], relationName: "itemAutorizador" }),
  cotacoes: many(osCotacoes),
}));

export const osCotacoesRelations = relations(osCotacoes, ({ one }) => ({
  item: one(osItens, { fields: [osCotacoes.osItemId], references: [osItens.id] }),
  fornecedor: one(fornecedores, { fields: [osCotacoes.fornecedorId], references: [fornecedores.id] }),
}));

export const osPagamentosRelations = relations(osPagamentos, ({ one }) => ({
  os: one(ordensServico, { fields: [osPagamentos.osId], references: [ordensServico.id] }),
  contaOrcamentaria: one(contasOrcamentarias, { fields: [osPagamentos.contaOrcamentariaId], references: [contasOrcamentarias.id] }),
  fornecedor: one(fornecedores, { fields: [osPagamentos.fornecedorId], references: [fornecedores.id] }),
  aceitoPorOperador: one(operadores, { fields: [osPagamentos.aceitoPor], references: [operadores.id] }),
}));

export const osComprasRelations = relations(osCompras, ({ one }) => ({
  os: one(ordensServico, { fields: [osCompras.osId], references: [ordensServico.id] }),
}));

export const osObservacoesClienteRelations = relations(osObservacoesCliente, ({ one }) => ({
  os: one(ordensServico, { fields: [osObservacoesCliente.osId], references: [ordensServico.id] }),
}));

export const osAvaliacoesRelations = relations(osAvaliacoes, ({ one }) => ({
  os: one(ordensServico, { fields: [osAvaliacoes.osId], references: [ordensServico.id] }),
  fornecedor: one(fornecedores, { fields: [osAvaliacoes.fornecedorId], references: [fornecedores.id] }),
}));

export const osOrcamentosClienteRelations = relations(osOrcamentosCliente, ({ one }) => ({
  os: one(ordensServico, { fields: [osOrcamentosCliente.osId], references: [ordensServico.id] }),
}));

export const osAnexosRelations = relations(osAnexos, ({ one }) => ({
  os: one(ordensServico, { fields: [osAnexos.osId], references: [ordensServico.id] }),
}));

export const osMecanicosRelations = relations(osMecanicos, ({ one }) => ({
  os: one(ordensServico, { fields: [osMecanicos.osId], references: [ordensServico.id] }),
  mecanico: one(mecanicos, { fields: [osMecanicos.mecanicoId], references: [mecanicos.id] }),
}));

export const veiculosRelations = relations(veiculos, ({ one, many }) => ({
  lojaOperacao: one(lojas, { fields: [veiculos.lojaOperacaoId], references: [lojas.id], relationName: "lojaOp" }),
  lojaProprietaria: one(lojas, { fields: [veiculos.lojaProprietariaId], references: [lojas.id], relationName: "lojaProp" }),
  ordensServico: many(ordensServico),
  contratos: many(contratos),
}));

export const contratosRelations = relations(contratos, ({ one }) => ({
  cliente: one(clientes, { fields: [contratos.clienteId], references: [clientes.id] }),
  veiculo: one(veiculos, { fields: [contratos.veiculoId], references: [veiculos.id] }),
}));

// ============================================================
// TIPOS EXPORTADOS PARA USO NAS ROTAS
// ============================================================

export type OrdemServico = typeof ordensServico.$inferSelect;
export type NovaOrdemServico = typeof ordensServico.$inferInsert;
export type OsItem = typeof osItens.$inferSelect;
export type NovoOsItem = typeof osItens.$inferInsert;
export type OsPagamento = typeof osPagamentos.$inferSelect;
export type NovoOsPagamento = typeof osPagamentos.$inferInsert;
export type OsCompra = typeof osCompras.$inferSelect;
export type OsCotacao = typeof osCotacoes.$inferSelect;
export type OsObservacaoCliente = typeof osObservacoesCliente.$inferSelect;
export type OsAvaliacao = typeof osAvaliacoes.$inferSelect;
export type OsOrcamentoCliente = typeof osOrcamentosCliente.$inferSelect;
export type OsAnexo = typeof osAnexos.$inferSelect;
export type Fornecedor = typeof fornecedores.$inferSelect;
export type CentroCusto = typeof centrosCusto.$inferSelect;
export type TipoOs = typeof tiposOs.$inferSelect;
export type Veiculo = typeof veiculos.$inferSelect;
export type Loja = typeof lojas.$inferSelect;
export type Contrato = typeof contratos.$inferSelect;
export type Cliente = typeof clientes.$inferSelect;
export type Operador = typeof operadores.$inferSelect;
export type Mecanico = typeof mecanicos.$inferSelect;
export type ClassificacaoServico = typeof classificacoesServico.$inferSelect;
export type ContaOrcamentaria = typeof contasOrcamentarias.$inferSelect;
export type PosicaoOperacional = typeof posicoesOperacionais.$inferSelect;