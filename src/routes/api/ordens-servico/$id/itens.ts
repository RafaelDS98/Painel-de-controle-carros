import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const criarItemSchema = z.object({
  aprovacao: z.enum(["pendente", "autorizado", "negado"]).default("pendente"),
  codServico: z.string().max(30).optional(),
  codPeca: z.string().max(30).optional(),
  descricao: z.string().min(1),
  quantidade: z.number().positive().default(1),
  valorUnitario: z.number().nonnegative().default(0),
  pecaServico: z.enum(["peca", "servico"]).default("servico"),
  contaOrcamentariaId: z.number().int().positive().optional(),
  mecanicoId: z.number().int().positive().optional(),
  laudo: z.string().optional(),
  classificacaoServicoId: z.number().int().positive().optional(),
  solicitanteId: z.number().int().positive().optional(),
  autorizadorId: z.number().int().positive().optional(),
  dataMovimentacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observacao: z.string().optional(),
  ultimaOcorrencia: z.string().optional(),
  servicoProgramado: z.boolean().default(false),
});

const atualizarItemSchema = criarItemSchema.partial();

export const Route = createFileRoute("/api/ordens-servico/$id/itens")({
  server: {
    handlers: {
      // GET /api/ordens-servico/:id/itens - Listar itens da OS
      GET: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const { data, error } = await supabaseAdmin
            .from("os_itens")
            .select(`
              *,
              mecanico:mecanicos(id, nome),
              conta_orcamentaria:contas_orcamentarias(id, codigo, nome),
              classificacao_servico:classificacoes_servico(id, nome),
              solicitante_item:operadores!os_itens_solicitante_id_fkey(id, nome),
              autorizador_item:operadores!os_itens_autorizador_id_fkey(id, nome),
              os_cotacoes(*, fornecedor:fornecedores(id, nome))
            `)
            .eq("os_id", osId)
            .order("created_at", { ascending: true });

          if (error) throw error;
          return json({ data: data ?? [] });
        } catch (e) {
          console.error("[os-itens] GET error:", e);
          return json({ error: "Erro interno" }, 500);
        }
      },

      // POST /api/ordens-servico/:id/itens - Adicionar item
      POST: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = criarItemSchema.parse(body);

          // Calcular total
          const total = dados.quantidade * dados.valorUnitario;

          const { data, error } = await supabaseAdmin
            .from("os_itens")
            .insert({
              os_id: osId,
              ...dados,
              total: total.toFixed(2),
              valor_unitario: dados.valorUnitario.toFixed(2),
              quantidade: dados.quantidade.toFixed(2),
            })
            .select("*")
            .single();

          if (error) throw error;

          // Atualizar totais da OS
          await atualizarTotaisOs(supabaseAdmin, osId);

          return json({ data }, 201);
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[os-itens] POST error:", e);
          return json({ error: "Erro ao adicionar item" }, 500);
        }
      },
    },
  },
});

// PUT e DELETE para item específico
export const ItemRoute = createFileRoute("/api/ordens-servico/$id/itens/$itemId")({
  server: {
    handlers: {
      PUT: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const itemId = parseInt(params.itemId);
          if (isNaN(itemId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = atualizarItemSchema.parse(body);

          const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

          if (dados.quantidade !== undefined) updateData.quantidade = dados.quantidade.toFixed(2);
          if (dados.valorUnitario !== undefined) updateData.valor_unitario = dados.valorUnitario.toFixed(2);

          // Recalcular total se quantidade ou valor mudou
          if (dados.quantidade !== undefined || dados.valorUnitario !== undefined) {
            const { data: item } = await supabaseAdmin
              .from("os_itens")
              .select("quantidade, valor_unitario")
              .eq("id", itemId)
              .single();

            if (item) {
              const qtd = dados.quantidade ?? parseFloat(item.quantidade);
              const val = dados.valorUnitario ?? parseFloat(item.valor_unitario);
              updateData.total = (qtd * val).toFixed(2);
            }
          }

          // Mapear camelCase para snake_case
          const fieldMap: Record<string, string> = {
            aprovacao: "aprovacao",
            codServico: "cod_servico",
            codPeca: "cod_peca",
            descricao: "descricao",
            pecaServico: "peca_servico",
            contaOrcamentariaId: "conta_orcamentaria_id",
            mecanicoId: "mecanico_id",
            laudo: "laudo",
            classificacaoServicoId: "classificacao_servico_id",
            solicitanteId: "solicitante_id",
            autorizadorId: "autorizador_id",
            dataMovimentacao: "data_movimentacao",
            observacao: "observacao",
            ultimaOcorrencia: "ultima_ocorrencia",
            servicoProgramado: "servico_programado",
          };

          for (const [key, value] of Object.entries(dados)) {
            if (value !== undefined && fieldMap[key]) {
              updateData[fieldMap[key]] = value;
            }
          }

          const { data, error } = await supabaseAdmin
            .from("os_itens")
            .update(updateData)
            .eq("id", itemId)
            .select("*")
            .single();

          if (error) throw error;

          // Atualizar totais da OS
          const { data: itemData } = await supabaseAdmin
            .from("os_itens")
            .select("os_id")
            .eq("id", itemId)
            .single();

          if (itemData) {
            await atualizarTotaisOs(supabaseAdmin, itemData.os_id);
          }

          return json({ data });
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[os-itens] PUT error:", e);
          return json({ error: "Erro ao atualizar item" }, 500);
        }
      },

      DELETE: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const itemId = parseInt(params.itemId);
          if (isNaN(itemId)) return json({ error: "ID inválido" }, 400);

          // Pegar os_id antes de deletar
          const { data: itemData } = await supabaseAdmin
            .from("os_itens")
            .select("os_id")
            .eq("id", itemId)
            .single();

          const { error } = await supabaseAdmin
            .from("os_itens")
            .delete()
            .eq("id", itemId);

          if (error) throw error;

          // Atualizar totais da OS
          if (itemData) {
            await atualizarTotaisOs(supabaseAdmin, itemData.os_id);
          }

          return json({ deleted: true });
        } catch (e) {
          console.error("[os-itens] DELETE error:", e);
          return json({ error: "Erro ao excluir item" }, 500);
        }
      },
    },
  },
});

// Função auxiliar para atualizar totais da OS
async function atualizarTotaisOs(supabaseAdmin: any, osId: number) {
  const { data: itens } = await supabaseAdmin
    .from("os_itens")
    .select("total, peca_servico")
    .eq("os_id", osId);

  const totalServico = itens
    ?.filter((i: any) => i.peca_servico === "servico")
    .reduce((sum: number, i: any) => sum + parseFloat(i.total || "0"), 0) ?? 0;

  const totalEstoque = itens
    ?.filter((i: any) => i.peca_servico === "peca")
    .reduce((sum: number, i: any) => sum + parseFloat(i.total || "0"), 0) ?? 0;

  const { data: compras } = await supabaseAdmin
    .from("os_compras")
    .select("valor")
    .eq("os_id", osId);

  const totalCompras = compras
    ?.reduce((sum: number, c: any) => sum + parseFloat(c.valor || "0"), 0) ?? 0;

  await supabaseAdmin
    .from("ordens_servico")
    .update({
      total_servico: totalServico.toFixed(2),
      total_estoque: totalEstoque.toFixed(2),
      total_os: (totalServico + totalEstoque).toFixed(2),
      total_compras: totalCompras.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq("id", osId);
}