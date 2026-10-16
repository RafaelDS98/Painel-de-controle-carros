import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const criarPagamentoSchema = z.object({
  contaOrcamentariaId: z.number().int().positive().optional(),
  fornecedorId: z.number().int().positive().optional(),
  quantParcelas: z.number().int().positive().default(1),
  intervaloDias: z.number().int().nonnegative().default(0),
  valorTotal: z.number().nonnegative(),
  formaPagamento: z.enum(["cartao_credito", "cartao_debito", "dinheiro", "pix", "boleto", "transferencia", "cheque", "cortesia", "outro"]).optional(),
  emissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  primeiroVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  diaPagamento: z.number().int().min(1).max(31).optional(),
  documento: z.string().max(50).optional(),
});

const atualizarPagamentoSchema = criarPagamentoSchema.partial().extend({
  aceito: z.boolean().optional(),
});

export const Route = createFileRoute("/api/ordens-servico/$id/pagamentos")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const { data, error } = await supabaseAdmin
            .from("os_pagamentos")
            .select(`
              *,
              conta_orcamentaria:contas_orcamentarias(id, codigo, nome),
              fornecedor:fornecedores(id, nome),
              aceito_por_operador:operadores!os_pagamentos_aceito_por_fkey(id, nome)
            `)
            .eq("os_id", osId)
            .order("created_at", { ascending: true });

          if (error) throw error;
          return json({ data: data ?? [] });
        } catch (e) {
          console.error("[os-pagamentos] GET error:", e);
          return json({ error: "Erro interno" }, 500);
        }
      },

      POST: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const osId = parseInt(params.id);
          if (isNaN(osId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json();
          const dados = criarPagamentoSchema.parse(body);

          const { data, error } = await supabaseAdmin
            .from("os_pagamentos")
            .insert({
              os_id: osId,
              ...dados,
              valor_total: dados.valorTotal.toFixed(2),
              aceito: false,
            })
            .select("*")
            .single();

          if (error) throw error;
          return json({ data }, 201);
        } catch (e) {
          if (e instanceof z.ZodError) {
            return json({ error: "Validação falhou", details: e.errors }, 400);
          }
          console.error("[os-pagamentos] POST error:", e);
          return json({ error: "Erro ao adicionar pagamento" }, 500);
        }
      },
    },
  },
});

// Aceitar pagamento (controle de aceites)
export const AceitarRoute = createFileRoute("/api/ordens-servico/$id/pagamentos/$pagamentoId/aceitar")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const pagamentoId = parseInt(params.pagamentoId);
          if (isNaN(pagamentoId)) return json({ error: "ID inválido" }, 400);

          const body = await request.json().catch(() => ({}));
          const operadorId = body.operadorId as number | undefined;

          const { data, error } = await supabaseAdmin
            .from("os_pagamentos")
            .update({
              aceito: true,
              aceito_por: operadorId ?? null,
              aceito_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", pagamentoId)
            .select("*")
            .single();

          if (error) throw error;
          return json({ data, aceito: true });
        } catch (e) {
          console.error("[os-pagamentos/aceitar] POST error:", e);
          return json({ error: "Erro ao aceitar pagamento" }, 500);
        }
      },
    },
  },
});