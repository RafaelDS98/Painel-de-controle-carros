import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const criarCotacaoSchema = z.object({
  osItemId: z.number().int().positive(),
  fornecedorId: z.number().int().positive(),
  valorUnitario: z.number().nonnegative(),
  prazoPagamento: z.string().max(50).optional(),
  observacao: z.string().optional(),
});

export const Route = createFileRoute("/api/ordens-servico/$id/cotacoes")({
  server: {
    handlers: {
      // GET todas cotações da OS
      GET: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const { data, error } = await supabaseAdmin
            .from("os_cotacoes")
            .select(`
              *,
              item:os_itens(id, descricao),
              fornecedor:fornecedores(id, nome)
            `)
            .in("os_item_id",
              supabaseAdmin.from("os_itens").select("id").eq("os_id", osId)
            )
            .order("created_at", { ascending: true });

          // Fallback: buscar via join
          const { data: itens } = await supabaseAdmin
            .from("os_itens")
            .select("id")
            .eq("os_id", osId);

          const itemIds = itens?.map((i: any) => i.id) ?? [];

          const { data: cotacoes, error: err2 } = await supabaseAdmin
            .from("os_cotacoes")
            .select(`
              *,
              item:os_itens(id, descricao),
              fornecedor:fornecedores(id, nome)
            `)
            .in("os_item_id", itemIds)
            .order("created_at", { ascending: true });

          if (err2) throw err2;
          return json({ data: cotacoes ?? [] });
        } catch (e) {
          console.error("[os-cotacoes] GET error:", e);
          return json({ error: "Erro interno" }, 500);
        }
      },
      POST: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = criarCotacaoSchema.parse(body);

          // Verificar limite de 3 cotações por item
          const { count } = await supabaseAdmin
            .from("os_cotacoes")
            .select("*", { count: "exact", head: true })
            .eq("os_item_id", dados.osItemId);

          if ((count ?? 0) >= 3) {
            return json({ error: "Limite de 3 cotações por item atingido" }, 400);
          }

          // Verificar se item pertence à OS
          const { data: item } = await supabaseAdmin
            .from("os_itens")
            .select("os_id")
            .eq("id", dados.osItemId)
            .single();

          if (!item || item.os_id !== osId) {
            return json({ error: "Item não pertence a esta OS" }, 400);
          }

          const total = dados.valorUnitario; // Valor unitário = total para cotação simples

          const { data, error } = await supabaseAdmin
            .from("os_cotacoes")
            .insert({
              ...dados,
              valor_unitario: dados.valorUnitario.toFixed(2),
              total: total.toFixed(2),
              selecionada: false,
            })
            .select(`
              *,
              fornecedor:fornecedores(id, nome)
            `)
            .single();

          if (error) throw error;
          return json({ data }, 201);
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[os-cotacoes] POST error:", e);
          return json({ error: "Erro ao adicionar cotação" }, 500);
        }
      },
    },
  },
});

// Selecionar cotação (marcar como escolhida)
export const SelecionarRoute = createFileRoute("/api/ordens-servico/$id/cotacoes/$cotacaoId/selecionar")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const cotacaoId = parseInt(params.cotacaoId);
          if (isNaN(cotacaoId)) return json({ error: "ID inválido" }, 400);

          // Pegar item da cotação
          const { data: cotacao } = await supabaseAdmin
            .from("os_cotacoes")
            .select("os_item_id")
            .eq("id", cotacaoId)
            .single();

          if (!cotacao) return json({ error: "Cotação não encontrada" }, 404);

          // Desmarcar outras cotações do mesmo item
          await supabaseAdmin
            .from("os_cotacoes")
            .update({ selecionada: false, updated_at: new Date().toISOString() })
            .eq("os_item_id", cotacao.os_item_id);

          // Marcar esta como selecionada
          const { data, error } = await supabaseAdmin
            .from("os_cotacoes")
            .update({ selecionada: true, updated_at: new Date().toISOString() })
            .eq("id", cotacaoId)
            .select("*")
            .single();

          if (error) throw error;
          return json({ data, selecionada: true });
        } catch (e) {
          console.error("[os-cotacoes/selecionar] POST error:", e);
          return json({ error: "Erro ao selecionar cotação" }, 500);
        }
      },
    },
  },
});