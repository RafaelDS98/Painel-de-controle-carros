import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateBR, formatDateTimeBR } from "@/lib/agenda-safety";
import { normalizePlate } from "@/lib/normalize";

type Kind = "finalizado" | "cancelado" | "";

/** Atendimentos/agendamentos encerrados: Finalizados e Cancelados sempre separados. */
export function ClosedAppointments() {
  const [kind, setKind] = useState<Kind>("finalizado");
  const [plate, setPlate] = useState("");
  const q = useQuery({
    queryKey: ["closed-appointments", kind, plate],
    queryFn: async () => {
      let r = supabase
        .from("appointments")
        .select(
          "id, date, time, plate, model, store, workshop, issue, origin, close_kind, close_reason, closed_at",
        )
        .not("closed_at", "is", null)
        .is("archived_at", null)
        .order("closed_at", { ascending: false })
        .limit(500);
      if (kind) r = r.eq("close_kind", kind);
      const p = normalizePlate(plate);
      if (p) r = r.ilike("plate", `%${p}%`);
      const { data, error } = await r;
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  return (
    <section className="mx-auto max-w-5xl space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["finalizado", "Finalizados"],
            ["cancelado", "Cancelados"],
            ["", "Todos"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={label}
            size="sm"
            variant={kind === k ? "default" : "outline"}
            onClick={() => setKind(k)}
          >
            {label}
          </Button>
        ))}
        <Input
          aria-label="Placa"
          placeholder="Placa"
          value={plate}
          onChange={(e) => setPlate(e.target.value)}
          className="w-40"
        />
        <span className="text-sm text-muted-foreground">{rows.length} registro(s)</span>
      </div>
      {q.isError && <p className="text-sm text-destructive">Não foi possível carregar.</p>}
      {!q.isLoading && !rows.length && (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum atendimento encerrado.
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-md border bg-card p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <strong>{r.plate}</strong>
              <span
                className={
                  r.close_kind === "cancelado"
                    ? "rounded border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                    : "rounded border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                }
              >
                {r.close_kind === "cancelado" ? "Cancelado" : "Finalizado"}
              </span>
              <span className="text-xs text-muted-foreground">
                {r.origin === "atendimento" ? "Atendimento sem agendamento" : "Agendamento"} ·{" "}
                {formatDateBR(r.date)} {r.time}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                Encerrado em {formatDateTimeBR(r.closed_at)}
              </span>
            </div>
            <p className="text-muted-foreground">
              {[r.model, r.store, r.workshop, r.issue].filter(Boolean).join(" · ") || "—"}
            </p>
            {r.close_reason && (
              <p>
                <span className="text-muted-foreground">
                  {r.close_kind === "cancelado" ? "Motivo:" : "Observação:"}
                </span>{" "}
                {r.close_reason}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
