import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const criarObservacaoSchema = z.object({
  descricao: z.string().min(1),
});

export const Route = createFileRoute("/api/ordens-servico/$id/observacoes")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const { data, error } = await supabaseAdmin
            .from("os_observacoes_cliente")
            .select("*")
            .eq("os_id", osId)
            .order("created_at", { ascending: false });

          if (error) throw error;
          return json({ data: data ?? [] });
        } catch (e) {
          console.error("[os-observacoes] GET error:", e);
          return json({ error: "Erro interno" }, 500);
        }
      },
      POST: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = criarObservacaoSchema.parse(body);

          const { data, error } = await supabaseAdmin
            .from("os_observacoes_cliente")
            .insert({
              os_id: osId,
              ...dados,
            })
            .select("*")
            .single();

          if (error) throw error;
          return json({ data }, 201);
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[os-observacoes] POST error:", e);
          return json({ error: "Erro ao adicionar observação" }, 500);
        }
      },
    },
  },
});

// Editar/Excluir observação
export const ObservacaoRoute = createFileRoute("/api/ordens-servico/$id/observacoes/$obsId")({
  server: {
    handlers: {
      PUT: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const obsId = parseInt(params.obsId);
          if (isNaN(obsId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = criarObservacaoSchema.partial().parse(body);

          const { data, error } = await supabaseAdmin
            .from("os_observacoes_cliente")
            .update({
              ...dados,
              updated_at: new Date().toISOString(),
            })
            .eq("id", obsId)
            .select("*")
            .single();

          if (error) throw error;
          return json({ data });
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[os-observacoes] PUT error:", e);
          return json({ error: "Erro ao atualizar observação" }, 500);
        }
      },
      DELETE: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const obsId = parseInt(params.obsId);
          if (isNaN(obsId)) return json({ error: "ID inválido" }, 400);

          const { error } = await supabaseAdmin
            .from("os_observacoes_cliente")
            .delete()
            .eq("id", obsId);

          if (error) throw error;
          return json({ deleted: true });
        } catch (e) {
          console.error("[os-observacoes] DELETE error:", e);
          return json({ error: "Erro ao excluir observação" }, 500);
        }
      },
    },
  },
});