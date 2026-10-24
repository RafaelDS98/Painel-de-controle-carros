import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fieldLabels } from "@/components/edit-history";
import { buildSummaryLines, countHighlights, type SummaryEvent } from "@/lib/history-summary";

const INSTRUCTIONS = `Você resume o histórico de alterações de um atendimento de manutenção de frota.
Escreva em português do Brasil, em até 6 frases curtas, em ordem cronológica.
Destaque primeiro as mudanças marcadas [DESTAQUE]: datas/previsões, Local/Oficina e Situação, dizendo de quê para quê e quando.
Depois cite em uma frase as demais alterações relevantes. Não invente nada além das linhas recebidas.`;

/** Resumo por IA das alterações de um atendimento; lê só o que o usuário pode ver (RLS). */
export const summarizeAppointmentHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { appointmentId: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(input?.appointmentId ?? ""))
      throw new Error("Atendimento inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: appt } = await context.supabase
      .from("appointments")
      .select("plate, date, status, workshop")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (!appt) return { summary: "", error: "Atendimento não encontrado." };
    const { data: rows, error } = await context.supabase
      .from("edit_log")
      .select("field_changed, old_value, new_value, changed_at, profiles(full_name)")
      .eq("appointment_id", data.appointmentId)
      .order("changed_at", { ascending: true })
      .range(0, 999);
    if (error) return { summary: "", error: "Não foi possível ler o histórico." };
    const events: SummaryEvent[] = (rows ?? []).map((r) => ({
      field: r.field_changed,
      oldValue: r.old_value,
      newValue: r.new_value,
      at: r.changed_at,
      by: (r.profiles as { full_name: string | null } | null)?.full_name ?? null,
    }));
    const counts = countHighlights(events);
    if (!events.length)
      return { summary: "Nenhuma alteração registrada neste atendimento.", counts };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { summary: "", counts, error: "Resumo por IA não configurado." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const header = `Placa ${appt.plate} · atendimento ${appt.date ?? "sem data"} · situação atual: ${appt.status || "sem situação"} · local atual: ${appt.workshop || "não informado"}`;
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        system: INSTRUCTIONS,
        messages: [
          { role: "user", content: [header, ...buildSummaryLines(events, fieldLabels)].join("\n") },
        ],
        maxRetries: 0,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const summary = (await result.text).trim();
      return { summary, counts };
    } catch (failure) {
      const status = (failure as { statusCode?: number })?.statusCode;
      console.error("history summary failed", status, failure);
      const error =
        status === 402
          ? "Créditos de IA esgotados. Recarregue em Configurações → Planos e créditos."
          : status === 429
            ? "Muitos pedidos de resumo agora. Tente em alguns instantes."
            : status === 403
              ? "O uso de IA está bloqueado para este espaço de trabalho."
              : "Não foi possível gerar o resumo agora.";
      return { summary: "", counts, error };
    }
  });
