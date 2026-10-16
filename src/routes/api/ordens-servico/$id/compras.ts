import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const criarCompraSchema = z.object({
  numeroCompra: z.string().min(1).max(50),
  valor: z.number().nonnegative().default(0),
  descricao: z.string().optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const Route = createFileRoute("/api/ordens-servico/$id/compras")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const { data, error } = await supabaseAdmin
            .from("os_compras")
            .select("*")
            .eq("os_id", osId)
            .order("created_at", { ascending: true });

          if (error) throw error;
          return json({ data: data ?? [] });
        } catch (e) {
          console.error("[os-compras] GET error:", e);
          return json({ error: "Erro interno" }, 500);
        }
      },
      POST: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = criarCompraSchema.parse(body);

          const { data, error } = await supabaseAdmin
            .from("os_compras")
            .insert({
              os_id: osId,
              ...dados,
              valor: dados.valor.toFixed(2),
            })
            .select("*")
            .single();

          if (error) throw error;

          // Atualizar total compras da OS
          const { data: compras } = await supabaseAdmin
            .from("os_compras")
            .select("valor")
            .eq("os_id", osId);

          const totalCompras = compras?.reduce((sum: number, c: any) => sum + parseFloat(c.valor || "0"), 0) ?? 0;

          const { data: osData } = await supabaseAdmin
            .from("ordens_servico")
            .select("total_os")
            .eq("id", osId)
            .single();

          await supabaseAdmin
            .from("ordens_servico")
            .update({
              total_compras: totalCompras.toFixed(2),
              updated_at: new Date().toISOString(),
            })
            .eq("id", osId);

          return json({ data }, 201);
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[os-compras] POST error:", e);
          return json({ error: "Erro ao vincular compra" }, 500);
        }
      },
    },
  },
});

// DELETE para desvincular compra
export const CompraRoute = createFileRoute("/api/ordens-servico/$id/compras/$compraId")({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          const compraId = parseInt(params.compraId);
          if (isNaN(osId) || isNaN(compraId)) return json({ error: "ID inválido" }, 400);

          const { error } = await supabaseAdmin
            .from("os_compras")
            .delete()
            .eq("id", compraId)
            .eq("os_id", osId);

          if (error) throw error;

          // Recalcular total compras
          const { data: compras } = await supabaseAdmin
            .from("os_compras")
            .select("valor")
            .eq("os_id", osId);

          const totalCompras = compras?.reduce((sum: number, c: any) => sum + parseFloat(c.valor || "0"), 0) ?? 0;

          await supabaseAdmin
            .from("ordens_servico")
            .update({
              total_compras: totalCompras.toFixed(2),
              updated_at: new Date().toISOString(),
            })
            .eq("id", osId);

          return json({ deleted: true });
        } catch (e) {
          console.error("[os-compras] DELETE error:", e);
          return json({ error: "Erro ao desvincular compra" }, 500);
        }
      },
    },
  },
});