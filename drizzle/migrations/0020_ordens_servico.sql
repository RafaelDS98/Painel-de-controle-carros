-- Migration: Ordens de Serviço - Schema completo
-- Data: 2026-10-15

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE os_status AS ENUM ('em_cotacao', 'aguardando_entrega', 'para_aprovacao', 'aprovada', 'em_andamento', 'cancelada', 'finalizada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_atendimento AS ENUM ('programado', 'emergencial', 'normal', 'devolucao');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tanque_nivel AS ENUM ('reserva', '1_8', '2_8', '3_8', '4_8', '5_8', '6_8', '7_8', 'cheio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gnv_nivel AS ENUM ('1', '2', '3', '4');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE aprovacao_item AS ENUM ('pendente', 'autorizado', 'negado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE executado AS ENUM ('sim', 'em_andamento', 'nao');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE autorizado_cliente AS ENUM ('sim', 'nao', 'pendente');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE peca_servico AS ENUM ('peca', 'servico');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_pagamento AS ENUM ('nao_lancado', 'a_vencer', 'vencido', 'pago');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE forma_pagamento AS ENUM ('cartao_credito', 'cartao_debito', 'dinheiro', 'pix', 'boleto', 'transferencia', 'cheque', 'cortesia', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE status_orcamento AS ENUM ('rascunho', 'enviado', 'aprovado', 'recusado', 'expirado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABELA DE SEQUÊNCIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS sequencias (
  nome VARCHAR(50) PRIMARY KEY,
  valor_atual INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Função para incrementar sequência (usada na geração de número OS)
CREATE OR REPLACE FUNCTION incrementar_sequencia(seq_nome VARCHAR)
RETURNS INTEGER AS $$
DECLARE
  novo_valor INTEGER;
BEGIN
  INSERT INTO sequencias (nome, valor_atual)
  VALUES (seq_nome, 1)
  ON CONFLICT (nome)
  DO UPDATE SET valor_atual = sequencias.valor_atual + 1, updated_at = NOW()
  RETURNING valor_atual INTO novo_valor;

  RETURN novo_valor;
END;
$$ LANGUAGE plpgsql;

-- Inicializar sequência de ordem de serviço
INSERT INTO sequencias (nome, valor_atual)
VALUES ('ordem_servico', 0)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================
-- CADASTROS DE APOIO
-- ============================================================

-- Lojas
CREATE TABLE IF NOT EXISTS lojas (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  razao_social VARCHAR(300),
  cnpj VARCHAR(20),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  telefone VARCHAR(20),
  email VARCHAR(200),
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS lojas_sgloc_id_idx ON lojas(sgloc_id);

-- Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(300) NOT NULL,
  razao_social VARCHAR(400),
  cnpj VARCHAR(20),
  cpf VARCHAR(15),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  telefone VARCHAR(20),
  email VARCHAR(200),
  contato VARCHAR(200),
  oficina BOOLEAN NOT NULL DEFAULT FALSE,
  pecas BOOLEAN NOT NULL DEFAULT FALSE,
  concessionaria BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  observacoes TEXT,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fornecedores_sgloc_id_idx ON fornecedores(sgloc_id);
CREATE INDEX IF NOT EXISTS fornecedores_nome_idx ON fornecedores(nome);

-- Centros de Custo
CREATE TABLE IF NOT EXISTS centros_custo (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS centros_custo_codigo_idx ON centros_custo(codigo);
CREATE UNIQUE INDEX IF NOT EXISTS centros_custo_sgloc_id_idx ON centros_custo(sgloc_id);

-- Tipos de OS
CREATE TABLE IF NOT EXISTS tipos_os (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  entra_custo_manut_veiculos BOOLEAN NOT NULL DEFAULT TRUE,
  exibe_abas_recebimento BOOLEAN NOT NULL DEFAULT FALSE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS tipos_os_sgloc_id_idx ON tipos_os(sgloc_id);

-- Classificações de Serviço
CREATE TABLE IF NOT EXISTS classificacoes_servico (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Posições Operacionais
CREATE TABLE IF NOT EXISTS posicoes_operacionais (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL,
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'inicial',
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS posicoes_op_codigo_idx ON posicoes_operacionais(codigo);

-- Contas Orçamentárias
CREATE TABLE IF NOT EXISTS contas_orcamentarias (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL,
  nome VARCHAR(300) NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS contas_orc_codigo_idx ON contas_orcamentarias(codigo);

-- Mecânicos
CREATE TABLE IF NOT EXISTS mecanicos (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  especialidade VARCHAR(100),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(300) NOT NULL,
  razao_social VARCHAR(400),
  cnpj VARCHAR(20),
  cpf VARCHAR(15),
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  telefone VARCHAR(20),
  email VARCHAR(200),
  contato VARCHAR(200),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS clientes_sgloc_id_idx ON clientes(sgloc_id);

-- Veículos
CREATE TABLE IF NOT EXISTS veiculos (
  id SERIAL PRIMARY KEY,
  placa VARCHAR(10) NOT NULL,
  prefixo VARCHAR(20),
  chassi VARCHAR(30) NOT NULL,
  montadora VARCHAR(100),
  modelo VARCHAR(100),
  ano_fabricacao INTEGER,
  ano_modelo INTEGER,
  categoria VARCHAR(50),
  grupo VARCHAR(50),
  combustivel VARCHAR(30),
  tanque_litros NUMERIC(6,2),
  km_atual INTEGER DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'ativo',
  loja_operacao_id INTEGER REFERENCES lojas(id),
  loja_proprietaria_id INTEGER REFERENCES lojas(id),
  estado VARCHAR(2),
  cor VARCHAR(50),
  renavam VARCHAR(20),
  data_compra DATE,
  observacoes TEXT,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS veiculos_placa_idx ON veiculos(placa);
CREATE UNIQUE INDEX IF NOT EXISTS veiculos_sgloc_id_idx ON veiculos(sgloc_id);
CREATE INDEX IF NOT EXISTS veiculos_montadora_idx ON veiculos(montadora);
CREATE INDEX IF NOT EXISTS veiculos_modelo_idx ON veiculos(modelo);

-- Contratos
CREATE TABLE IF NOT EXISTS contratos (
  id SERIAL PRIMARY KEY,
  numero VARCHAR(50) NOT NULL,
  cliente_id INTEGER REFERENCES clientes(id),
  veiculo_id INTEGER REFERENCES veiculos(id),
  data_inicio DATE,
  data_fim DATE,
  valor_mensal NUMERIC(12,2),
  status VARCHAR(30) NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS contratos_numero_idx ON contratos(numero);

-- Operadores
CREATE TABLE IF NOT EXISTS operadores (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(200),
  telefone VARCHAR(20),
  pode_autorizar BOOLEAN NOT NULL DEFAULT FALSE,
  pode_aceitar BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ORDEM DE SERVIÇO (TABELA PRINCIPAL)
-- ============================================================
CREATE TABLE IF NOT EXISTS ordens_servico (
  id SERIAL PRIMARY KEY,
  numero INTEGER NOT NULL,
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id),
  km INTEGER NOT NULL,
  data DATE NOT NULL,
  loja_id INTEGER NOT NULL REFERENCES lojas(id),
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
  status os_status NOT NULL DEFAULT 'para_aprovacao',
  tipo_os_id INTEGER NOT NULL REFERENCES tipos_os(id),
  centro_custo_id INTEGER NOT NULL REFERENCES centros_custo(id),
  hora TIME,
  tanque_inicial tanque_nivel,
  gnv_inicial gnv_nivel,
  posicao_inicial_id INTEGER REFERENCES posicoes_operacionais(id),
  tipo_atendimento tipo_atendimento,
  contrato_id INTEGER REFERENCES contratos(id),
  operador_recepcionou_id INTEGER REFERENCES operadores(id),
  condutor_nome VARCHAR(200),
  condutor_contato VARCHAR(100),
  nota_fiscal VARCHAR(50),
  recuperado BOOLEAN DEFAULT FALSE,
  referencia_os_externa VARCHAR(50),
  obs1 TEXT,
  obs2 TEXT,
  previsao_conclusao DATE,
  forma_pagamento forma_pagamento,
  solicitante_id INTEGER REFERENCES operadores(id),
  autorizador_id INTEGER REFERENCES operadores(id),
  pendencia BOOLEAN DEFAULT FALSE,
  desc_pendencia TEXT,
  agendar_proxima_os BOOLEAN DEFAULT FALSE,
  executado executado DEFAULT 'nao',
  autorizado_cliente autorizado_cliente DEFAULT 'pendente',
  data_final DATE,
  hora_final TIME,
  km_final INTEGER,
  tanque_final tanque_nivel,
  gnv_final gnv_nivel,
  posicao_final_id INTEGER REFERENCES posicoes_operacionais(id),
  status_pagamento status_pagamento DEFAULT 'nao_lancado',
  total_os NUMERIC(12,2) DEFAULT 0,
  total_servico NUMERIC(12,2) DEFAULT 0,
  total_estoque NUMERIC(12,2) DEFAULT 0,
  total_compras NUMERIC(12,2) DEFAULT 0,
  sgloc_id INTEGER,
  sgloc_synced_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS os_numero_idx ON ordens_servico(numero);
CREATE INDEX IF NOT EXISTS os_status_idx ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS os_data_idx ON ordens_servico(data);
CREATE INDEX IF NOT EXISTS os_veiculo_idx ON ordens_servico(veiculo_id);
CREATE INDEX IF NOT EXISTS os_loja_idx ON ordens_servico(loja_id);
CREATE INDEX IF NOT EXISTS os_fornecedor_idx ON ordens_servico(fornecedor_id);
CREATE INDEX IF NOT EXISTS os_tipo_os_idx ON ordens_servico(tipo_os_id);
CREATE INDEX IF NOT EXISTS os_centro_custo_idx ON ordens_servico(centro_custo_id);
CREATE UNIQUE INDEX IF NOT EXISTS os_sgloc_id_idx ON ordens_servico(sgloc_id);

-- ============================================================
-- ITENS DA OS
-- ============================================================
CREATE TABLE IF NOT EXISTS os_itens (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  aprovacao aprovacao_item NOT NULL DEFAULT 'pendente',
  cod_servico VARCHAR(30),
  cod_peca VARCHAR(30),
  descricao TEXT NOT NULL,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  peca_servico peca_servico NOT NULL DEFAULT 'servico',
  conta_orcamentaria_id INTEGER REFERENCES contas_orcamentarias(id),
  mecanico_id INTEGER REFERENCES mecanicos(id),
  laudo TEXT,
  classificacao_servico_id INTEGER REFERENCES classificacoes_servico(id),
  solicitante_id INTEGER REFERENCES operadores(id),
  autorizador_id INTEGER REFERENCES operadores(id),
  data_movimentacao DATE,
  observacao TEXT,
  ultima_ocorrencia TEXT,
  servico_programado BOOLEAN DEFAULT FALSE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS os_itens_os_idx ON os_itens(os_id);
CREATE INDEX IF NOT EXISTS os_itens_aprovacao_idx ON os_itens(aprovacao);

-- ============================================================
-- PAGAMENTOS DA OS
-- ============================================================
CREATE TABLE IF NOT EXISTS os_pagamentos (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  conta_orcamentaria_id INTEGER REFERENCES contas_orcamentarias(id),
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  quant_parcelas INTEGER DEFAULT 1,
  intervalo_dias INTEGER DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  forma_pagamento forma_pagamento,
  emissao DATE,
  primeiro_vencimento DATE,
  dia_pagamento INTEGER,
  documento VARCHAR(50),
  aceito BOOLEAN DEFAULT FALSE,
  aceito_por INTEGER REFERENCES operadores(id),
  aceito_em TIMESTAMP,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS os_pagamentos_os_idx ON os_pagamentos(os_id);

-- ============================================================
-- COMPRAS VINCULADAS
-- ============================================================
CREATE TABLE IF NOT EXISTS os_compras (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  numero_compra VARCHAR(50) NOT NULL,
  valor NUMERIC(12,2) DEFAULT 0,
  descricao TEXT,
  data DATE,
  sgloc_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS os_compras_os_idx ON os_compras(os_id);
CREATE INDEX IF NOT EXISTS os_compras_numero_idx ON os_compras(numero_compra);

-- ============================================================
-- COTAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS os_cotacoes (
  id SERIAL PRIMARY KEY,
  os_item_id INTEGER NOT NULL REFERENCES os_itens(id) ON DELETE CASCADE,
  fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  prazo_pagamento VARCHAR(50),
  observacao TEXT,
  selecionada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS os_cotacoes_item_idx ON os_cotacoes(os_item_id);

-- ============================================================
-- OBSERVAÇÕES DO CLIENTE
-- ============================================================
CREATE TABLE IF NOT EXISTS os_observacoes_cliente (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS os_obs_cliente_os_idx ON os_observacoes_cliente(os_id);

-- ============================================================
-- AVALIAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS os_avaliacoes (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  fornecedor_id INTEGER REFERENCES fornecedores(id),
  controle_qualidade NUMERIC(3,1),
  mercado_livre NUMERIC(3,1),
  pontualidade NUMERIC(3,1),
  preco NUMERIC(3,1),
  observacao TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS os_avaliacoes_os_idx ON os_avaliacoes(os_id);

-- ============================================================
-- ORÇAMENTO DO CLIENTE
-- ============================================================
CREATE TABLE IF NOT EXISTS os_orcamentos_cliente (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade NUMERIC(10,2) DEFAULT 1,
  valor NUMERIC(12,2) DEFAULT 0,
  imprimir_no_orcamento BOOLEAN DEFAULT TRUE,
  formacao_preco_taxa NUMERIC(5,2) DEFAULT 0,
  desconto NUMERIC(12,2) DEFAULT 0,
  taxa_servico NUMERIC(12,2) DEFAULT 0,
  emissao DATE,
  status status_orcamento DEFAULT 'rascunho',
  negociacao_cliente TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS os_orcamentos_os_idx ON os_orcamentos_cliente(os_id);

-- ============================================================
-- ANEXOS
-- ============================================================
CREATE TABLE IF NOT EXISTS os_anexos (
  id SERIAL PRIMARY KEY,
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  nome_arquivo VARCHAR(300) NOT NULL,
  url TEXT NOT NULL,
  tipo_mime VARCHAR(100),
  tamanho_bytes INTEGER,
  descricao TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS os_anexos_os_idx ON os_anexos(os_id);

-- ============================================================
-- MECÂNICOS DA OS (M:N)
-- ============================================================
CREATE TABLE IF NOT EXISTS os_mecanicos (
  os_id INTEGER NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
  mecanico_id INTEGER NOT NULL REFERENCES mecanicos(id),
  PRIMARY KEY (os_id, mecanico_id)
);

-- ============================================================
-- SEED: TIPOS DE OS (do SGLOC)
-- ============================================================
INSERT INTO tipos_os (nome, sgloc_id, exibe_abas_recebimento) VALUES
  ('M. corretiva', 1, FALSE),
  ('Avarias', 2, TRUE),
  ('Revisão concessionária', 3, FALSE),
  ('Inst. acessórios', 4, FALSE),
  ('Serviços elétricos', 5, FALSE),
  ('Lavagem', 6, FALSE),
  ('Assist. manutenção', 7, FALSE),
  ('Serv. em garantia', 8, FALSE),
  ('Combustível', 9, FALSE),
  ('Funilaria', 31, FALSE),
  ('Manut. interna locadora', 32, FALSE),
  ('Rastreador', 33, FALSE),
  ('Guincho', 34, FALSE),
  ('Adaptação de veículos', 35, FALSE),
  ('Serviços externos', 36, FALSE),
  ('M. preventiva', 37, FALSE),
  ('Retorno de serviços', 38, FALSE),
  ('Serviços interior', 39, FALSE),
  ('Reparo diversos', 40, FALSE),
  ('Pneus', 41, TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: POSIÇÕES OPERACIONAIS
-- ============================================================
INSERT INTO posicoes_operacionais (codigo, nome, tipo) VALUES
  ('OR', 'Oficina Revisão', 'inicial'),
  ('OT', 'Oficina Terceiros', 'inicial'),
  ('OQ', 'Pátio Controle Qualidade', 'inicial'),
  ('OF', 'Pintura e Funilaria', 'inicial'),
  ('DQ', 'Disponível QC', 'final'),
  ('DC', 'Disponível Cliente', 'final'),
  ('DP', 'Disponível Pátio', 'final'),
  ('DL', 'Disponível Lavagem', 'final'),
  ('DT', 'Disponível Terceiros', 'final'),
  ('DV', 'Disponível Venda', 'final'),
  ('DR', 'Disponível Reserva', 'final'),
  ('D0', 'Disponível', 'final')
ON CONFLICT DO NOTHING;