import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const criarAnexoSchema = z.object({
  nomeArquivo: z.string().min(1).max(300),
  url: z.string().url(),
  tipoMime: z.string().max(100).optional(),
  tamanhoBytes: z.number().int().nonnegative().optional(),
  descricao: z.string().optional(),
});

export const Route = createFileRoute("/api/ordens-servico/$id/anexos")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const { data, error } = await supabaseAdmin
            .from("os_anexos")
            .select("*")
            .eq("os_id", osId)
            .order("created_at", { ascending: false });

          if (error) throw error;
          return json({ data: data ?? [] });
        } catch (e) {
          console.error("[os-anexos] GET error:", e);
          return json({ error: "Erro interno" }, 500);
        }
      },
      POST: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = criarAnexoSchema.parse(body);

          const { data, error } = await supabaseAdmin
            .from("os_anexos")
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
          console.error("[os-anexos] POST error:", e);
          return json({ error: "Erro ao adicionar anexo" }, 500);
        }
      },
    },
  },
});

// Excluir anexo
export const AnexoRoute = createFileRoute("/api/ordens-servico/$id/anexos/$anexoId")({
  server: {
    handlers: {
      DELETE: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const anexoId = parseInt(params.anexoId);
          if (isNaN(anexoId)) return json({ error: "ID inválido" }, 400);

          const { error } = await supabaseAdmin
            .from("os_anexos")
            .delete()
            .eq("id", anexoId);

          if (error) throw error;
          return json({ deleted: true });
        } catch (e) {
          console.error("[os-anexos] DELETE error:", e);
          return json({ error: "Erro ao excluir anexo" }, 500);
        }
      },
    },
  },
});