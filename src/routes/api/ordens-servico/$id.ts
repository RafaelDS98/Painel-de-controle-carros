import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const atualizarOsSchema = z.object({
  veiculoId: z.number().int().positive().optional(),
  km: z.number().int().nonnegative().optional(),
  lojaId: z.number().int().positive().optional(),
  fornecedorId: z.number().int().positive().optional(),
  tipoOsId: z.number().int().positive().optional(),
  centroCustoId: z.number().int().positive().optional(),
  status: z.enum(["em_cotacao", "aguardando_entrega", "para_aprovacao", "aprovada", "em_andamento", "cancelada", "finalizada"]).optional(),
  hora: z.string().optional(),
  tanqueInicial: z.enum(["reserva", "1_8", "2_8", "3_8", "4_8", "5_8", "6_8", "7_8", "cheio"]).nullable().optional(),
  gnvInicial: z.enum(["1", "2", "3", "4"]).nullable().optional(),
  posicaoInicialId: z.number().int().positive().nullable().optional(),
  tipoAtendimento: z.enum(["programado", "emergencial", "normal", "devolucao"]).nullable().optional(),
  contratoId: z.number().int().positive().nullable().optional(),
  operadorRecepcionouId: z.number().int().positive().nullable().optional(),
  condutorNome: z.string().max(200).nullable().optional(),
  condutorContato: z.string().max(100).nullable().optional(),
  notaFiscal: z.string().max(50).nullable().optional(),
  recuperado: z.boolean().optional(),
  referenciaOsExterna: z.string().max(50).nullable().optional(),
  obs1: z.string().nullable().optional(),
  obs2: z.string().nullable().optional(),
  previsaoConclusao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  formaPagamento: z.enum(["cartao_credito", "cartao_debito", "dinheiro", "pix", "boleto", "transferencia", "cheque", "cortesia", "outro"]).nullable().optional(),
  solicitanteId: z.number().int().positive().nullable().optional(),
  autorizadorId: z.number().int().positive().nullable().optional(),
  pendencia: z.boolean().optional(),
  descPendencia: z.string().nullable().optional(),
  agendarProximaOs: z.boolean().optional(),
  executado: z.enum(["sim", "em_andamento", "nao"]).optional(),
  autorizadoCliente: z.enum(["sim", "nao", "pendente"]).optional(),
  // Finalização
  dataFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  horaFinal: z.string().nullable().optional(),
  kmFinal: z.number().int().nonnegative().nullable().optional(),
  tanqueFinal: z.enum(["reserva", "1_8", "2_8", "3_8", "4_8", "5_8", "6_8", "7_8", "cheio"]).nullable().optional(),
  gnvFinal: z.enum(["1", "2", "3", "4"]).nullable().optional(),
  posicaoFinalId: z.number().int().positive().nullable().optional(),
});

export const Route = createFileRoute("/api/ordens-servico/$id")({
  server: {
    handlers: {
      // GET /api/ordens-servico/:id - Detalhe completo com relações
      GET: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const id = parseInt(params.id);
          if (isNaN(id)) return json({ error: "ID inválido" }, 400);

          const { data, error } = await supabaseAdmin
            .from("ordens_servico")
            .select(`
              *,
              veiculo:veiculos(id, placa, prefixo, chassi, modelo, montadora, categoria, ano_fabricacao, ano_modelo, km_atual),
              loja:lojas(id, nome, razao_social, cnpj, endereco, cidade, estado, telefone),
              fornecedor:fornecedores(id, nome, razao_social, cnpj, endereco, cidade, estado, telefone, email, contato),
              tipo_os:tipos_os(id, nome),
              centro_custo:centros_custo(id, codigo, nome),
              posicao_inicial:posicoes_operacionais!ordens_servico_posicao_inicial_id_fkey(id, codigo, nome),
              posicao_final:posicoes_operacionais!ordens_servico_posicao_final_id_fkey(id, codigo, nome),
              contrato:contratos(id, numero, cliente:clientes(id, nome)),
              operador_recepcionou:operadores!ordens_servico_operador_recepcionou_id_fkey(id, nome),
              solicitante:operadores!ordens_servico_solicitante_id_fkey(id, nome),
              autorizador:operadores!ordens_servico_autorizador_id_fkey(id, nome),
              os_itens(*, mecanico:mecanicos(id, nome), conta_orcamentaria:contas_orcamentarias(id, codigo, nome), classificacao_servico:classificacoes_servico(id, nome), solicitante_item:operadores!os_itens_solicitante_id_fkey(id, nome), autorizador_item:operadores!os_itens_autorizador_id_fkey(id, nome), os_cotacoes(*, fornecedor:fornecedores(id, nome))),
              os_pagamentos(*, conta_orcamentaria:contas_orcamentarias(id, codigo, nome), fornecedor:fornecedores(id, nome), aceito_por_operador:operadores!os_pagamentos_aceito_por_fkey(id, nome)),
              os_compras(*),
              os_observacoes_cliente(*),
              os_avaliacoes(*, fornecedor:fornecedores(id, nome)),
              os_orcamentos_cliente(*),
              os_anexos(*),
              os_mecanicos(mecanico:mecanicos(id, nome))
            `)
            .eq("id", id)
            .single();

          if (error) {
            if (error.code === "PGRST116") return json({ error: "OS não encontrada" }, 404);
            throw error;
          }
          return json({ data });
        } catch (e) {
          console.error("[ordens-servico/$id] GET error:", e);
          return json({ error: "Erro interno" }, 500);
        }
      },

      // PUT /api/ordens-servico/:id - Atualizar OS
      PUT: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const id = parseInt(params.id);
          if (isNaN(id)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = atualizarOsSchema.parse(body);

          // Converter null em undefined para campos opcionais
          const updateData: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(dados)) {
            if (value !== undefined) {
              updateData[key] = value === null ? null : value;
            }
          }
          updateData.updated_at = new Date().toISOString();

          const { data, error } = await supabaseAdmin
            .from("ordens_servico")
            .update(updateData)
            .eq("id", id)
            .select(`
              *,
              veiculo:veiculos(id, placa, prefixo, modelo),
              loja:lojas(id, nome),
              fornecedor:fornecedores(id, nome),
              tipo_os:tipos_os(id, nome),
              centro_custo:centros_custo(id, codigo, nome)
            `)
            .single();

          if (error) {
            if (error.code === "PGRST116") return json({ error: "OS não encontrada" }, 404);
            throw error;
          }
          return json({ data });
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[ordens-servico/$id] PUT error:", e);
          return json({ error: "Erro ao atualizar ordem de serviço" }, 500);
        }
      },

      // DELETE /api/ordens-servico/:id - Excluir OS (soft delete via status cancelada ou hard delete)
      DELETE: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const id = parseInt(params.id);
          if (isNaN(id)) return json({ error: "ID inválido" }, 400);

          const url = new URL(request.url);
          const hardDelete = url.searchParams.get("hard") === "true";

          if (hardDelete) {
            const { error } = await supabaseAdmin.from("ordens_servico").delete().eq("id", id);
            if (error) throw error;
            return json({ deleted: true });
          } else {
            // Soft delete: marca como cancelada
            const { data, error } = await supabaseAdmin
              .from("ordens_servico")
              .update({ status: "cancelada", updated_at: new Date().toISOString() })
              .eq("id", id)
              .select("id, numero, status")
              .single();
            if (error) throw error;
            return json({ data, cancelled: true });
          }
        } catch (e) {
          console.error("[ordens-servico/$id] DELETE error:", e);
          return json({ error: "Erro ao excluir ordem de serviço" }, 500);
        }
      },
    },
  },
});