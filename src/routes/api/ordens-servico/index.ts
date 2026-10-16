import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Schema de validação para criação de OS
const criarOsSchema = z.object({
  veiculoId: z.number().int().positive(),
  km: z.number().int().nonnegative(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lojaId: z.number().int().positive(),
  fornecedorId: z.number().int().positive(),
  tipoOsId: z.number().int().positive(),
  centroCustoId: z.number().int().positive(),
  hora: z.string().optional(),
  tanqueInicial: z.enum(["reserva", "1_8", "2_8", "3_8", "4_8", "5_8", "6_8", "7_8", "cheio"]).optional(),
  gnvInicial: z.enum(["1", "2", "3", "4"]).optional(),
  posicaoInicialId: z.number().int().positive().optional(),
  tipoAtendimento: z.enum(["programado", "emergencial", "normal", "devolucao"]).optional(),
  contratoId: z.number().int().positive().optional(),
  operadorRecepcionouId: z.number().int().positive().optional(),
  condutorNome: z.string().max(200).optional(),
  condutorContato: z.string().max(100).optional(),
  notaFiscal: z.string().max(50).optional(),
  recuperado: z.boolean().optional(),
  referenciaOsExterna: z.string().max(50).optional(),
  obs1: z.string().optional(),
  obs2: z.string().optional(),
  previsaoConclusao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  formaPagamento: z.enum(["cartao_credito", "cartao_debito", "dinheiro", "pix", "boleto", "transferencia", "cheque", "cortesia", "outro"]).optional(),
  solicitanteId: z.number().int().positive().optional(),
  autorizadorId: z.number().int().positive().optional(),
  pendencia: z.boolean().optional(),
  descPendencia: z.string().optional(),
  agendarProximaOs: z.boolean().optional(),
  executado: z.enum(["sim", "em_andamento", "nao"]).optional(),
  autorizadoCliente: z.enum(["sim", "nao", "pendente"]).optional(),
});

// Schema para filtros da lista
const filtrosSchema = z.object({
  status: z.array(z.string()).optional(),
  tipoOs: z.array(z.number()).optional(),
  numero: z.string().optional(),
  centroCustoId: z.number().optional(),
  recuperado: z.boolean().optional(),
  referenciaOs: z.string().optional(),
  dataInicial: z.string().optional(),
  dataFinal: z.string().optional(),
  palavraChave: z.string().optional(),
  fornecedorId: z.number().optional(),
  numeroCompra: z.string().optional(),
  comPendencia: z.boolean().optional(),
  lojaId: z.number().optional(),
  placaPrefixo: z.string().optional(),
  montadora: z.string().optional(),
  modelo: z.string().optional(),
  contratoId: z.number().optional(),
  infoPagamento: z.enum(["em_aberto", "pago", "cortesia"]).optional(),
  pecaEstoque: z.string().optional(),
  categoriaVeiculo: z.string().optional(),
  clienteId: z.number().optional(),
  tipoAtendimento: z.enum(["programado", "emergencial", "normal", "devolucao"]).optional(),
  mecanicoId: z.number().optional(),
  classificacaoServicoId: z.number().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  sortBy: z.string().default("data"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const Route = createFileRoute("/api/ordens-servico/")({
  server: {
    handlers: {
      // GET /api/ordens-servico - Lista com filtros
      GET: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const url = new URL(request.url);
          const params = Object.fromEntries(url.searchParams.entries());

          // Parse array params
          if (params.status) params.status = params.status.split(",");
          if (params.tipoOs) params.tipoOs = params.tipoOs.split(",").map(Number);

          const filtros = filtrosSchema.parse(params);

          let query = supabaseAdmin
            .from("ordens_servico")
            .select(`
              *,
              veiculo:veiculos(id, placa, prefixo, modelo, montadora, categoria),
              loja:lojas(id, nome),
              fornecedor:fornecedores(id, nome),
              tipo_os:tipos_os(id, nome),
              centro_custo:centros_custo(id, codigo, nome),
              posicao_inicial:posicoes_operacionais!ordens_servico_posicao_inicial_id_fkey(id, codigo, nome),
              posicao_final:posicoes_operacionais!ordens_servico_posicao_final_id_fkey(id, codigo, nome),
              contrato:contratos(id, numero),
              operador_recepcionou:operadores!ordens_servico_operador_recepcionou_id_fkey(id, nome),
              solicitante:operadores!ordens_servico_solicitante_id_fkey(id, nome),
              autorizador:operadores!ordens_servico_autorizador_id_fkey(id, nome)
            `, { count: "exact" });

          // Aplicar filtros
          if (filtros.status?.length) {
            query = query.in("status", filtros.status);
          }
          if (filtros.tipoOs?.length) {
            query = query.in("tipo_os_id", filtros.tipoOs);
          }
          if (filtros.numero) {
            query = query.eq("numero", parseInt(filtros.numero));
          }
          if (filtros.centroCustoId) {
            query = query.eq("centro_custo_id", filtros.centroCustoId);
          }
          if (filtros.recuperado !== undefined) {
            query = query.eq("recuperado", filtros.recuperado);
          }
          if (filtros.referenciaOs) {
            query = query.ilike("referencia_os_externa", `%${filtros.referenciaOs}%`);
          }
          if (filtros.dataInicial) {
            query = query.gte("data", filtros.dataInicial);
          }
          if (filtros.dataFinal) {
            query = query.lte("data", filtros.dataFinal);
          }
          if (filtros.fornecedorId) {
            query = query.eq("fornecedor_id", filtros.fornecedorId);
          }
          if (filtros.comPendencia) {
            query = query.eq("pendencia", true);
          }
          if (filtros.lojaId) {
            query = query.eq("loja_id", filtros.lojaId);
          }
          if (filtros.placaPrefixo) {
            query = query.or(`veiculo.placa.ilike.%${filtros.placaPrefixo}%,veiculo.prefixo.ilike.%${filtros.placaPrefixo}%`);
          }
          if (filtros.montadora) {
            query = query.eq("veiculo.montadora", filtros.montadora);
          }
          if (filtros.modelo) {
            query = query.eq("veiculo.modelo", filtros.modelo);
          }
          if (filtros.contratoId) {
            query = query.eq("contrato_id", filtros.contratoId);
          }
          if (filtros.infoPagamento) {
            const statusMap = { em_aberto: ["nao_lancado", "a_vencer", "vencido"], pago: ["pago"], cortesia: [] };
            const statuses = statusMap[filtros.infoPagamento];
            if (statuses.length) query = query.in("status_pagamento", statuses);
          }
          if (filtros.categoriaVeiculo) {
            query = query.eq("veiculo.categoria", filtros.categoriaVeiculo);
          }
          if (filtros.tipoAtendimento) {
            query = query.eq("tipo_atendimento", filtros.tipoAtendimento);
          }

          // Palavra-chave busca em vários campos
          if (filtros.palavraChave) {
            query = query.or(`obs1.ilike.%${filtros.palavraChave}%,obs2.ilike.%${filtros.palavraChave}%,nota_fiscal.ilike.%${filtros.palavraChave}%`);
          }

          // Ordenação e paginação
          const ascending = filtros.sortOrder === "asc";
          query = query.order(filtros.sortBy, { ascending });

          const from = (filtros.page - 1) * filtros.pageSize;
          const to = from + filtros.pageSize - 1;
          query = query.range(from, to);

          const { data, error, count } = await query;

          if (error) throw error;

          return json({
            data: data ?? [],
            total: count ?? 0,
            page: filtros.page,
            pageSize: filtros.pageSize,
            totalPages: Math.ceil((count ?? 0) / filtros.pageSize),
          });
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[ordens-servico] GET error:", e);
          return json({ error: "Erro interno" }, 500);
        }
      },

      // POST /api/ordens-servico - Criar nova OS
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const body = await request.json();
          const dados = criarOsSchema.parse(body);

          // Gerar número sequencial global
          const { data: seqData, error: seqError } = await supabaseAdmin
            .rpc("incrementar_sequencia", { seq_nome: "ordem_servico" });

          if (seqError) throw seqError;
          const numero = seqData as number;

          // Inserir OS
          const { data, error } = await supabaseAdmin
            .from("ordens_servico")
            .insert({
              numero,
              ...dados,
              status: "para_aprovacao",
              status_pagamento: "nao_lancado",
              total_os: "0",
              total_servico: "0",
              total_estoque: "0",
              total_compras: "0",
            })
            .select(`
              *,
              veiculo:veiculos(id, placa, prefixo, modelo),
              loja:lojas(id, nome),
              fornecedor:fornecedores(id, nome),
              tipo_os:tipos_os(id, nome),
              centro_custo:centros_custo(id, codigo, nome)
            `)
            .single();

          if (error) throw error;

          return json({ data, numero }, 201);
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[ordens-servico] POST error:", e);
          return json({ error: "Erro ao criar ordem de serviço" }, 500);
        }
      },
    },
  },
});