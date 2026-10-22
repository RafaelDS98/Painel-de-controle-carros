import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { useOperationTypes } from "@/lib/vistoria-data";
import { spDay } from "@/lib/vistoria-stats";

export const Route = createFileRoute("/vistoria/ao-vivo")({
  head: () => ({
    meta: [
      { title: "Ao Vivo | ANPEXC Vistorias" },
      { name: "description", content: "Quadro em tempo real das vistorias por tipo de operação." },
      { property: "og:title", content: "Ao Vivo | ANPEXC Vistorias" },
      { property: "og:description", content: "Quadro em tempo real das vistorias por tipo de operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AoVivo,
});

function AoVivo() {
  const qc = useQueryClient();
  const ops = useOperationTypes();
  const [days, setDays] = useState(1);
  const [plate, setPlate] = useState("");
  const q = useQuery({
    queryKey: ["inspections", "live", days],
    queryFn: async () => {
      const since = `${spDay(new Date(Date.now() - (days - 1) * 86400_000))}T00:00:00-03:00`;
      const { data, error } = await supabase
        .from("inspections")
        .select("id,number,plate,operation_type_id,operation_name,damage_count,created_at,vehicle_id,vehicles(modelo)")
        .eq("status", "concluida")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("vistorias-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "inspections" }, () => {
        void qc.invalidateQueries({ queryKey: ["inspections"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [qc]);
  const term = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const rows = (q.data ?? []).filter((r) => !term || r.plate.includes(term));
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Radio className="h-5 w-5 text-destructive" /> Ao Vivo
        </h1>
        <select aria-label="Período" value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-auto h-10 rounded-md border bg-background px-2 text-sm">
          <option value={1}>Hoje</option>
          <option value={3}>3 dias</option>
          <option value={7}>7 dias</option>
        </select>
        <Input placeholder="Buscar placa" value={plate} onChange={(e) => setPlate(e.target.value)} className="h-10 w-40" />
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {(ops.data ?? []).map((o) => {
          const list = rows.filter((r) => r.operation_type_id === o.id);
          return (
            <section key={o.id} className="flex w-64 shrink-0 flex-col rounded-xl border bg-muted/30">
              <h2 className="flex items-center justify-between border-b px-3 py-2 text-sm font-semibold">
                {o.name}
                <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{list.length}</span>
              </h2>
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {list.map((r) => (
                  <Link key={r.id} to="/vistoria/$id" params={{ id: r.id }} className="block rounded-lg border bg-card p-2 text-sm hover:border-primary">
                    <div className="flex items-center gap-2">
                      <span className="rounded border bg-white px-1.5 font-mono font-bold text-black">{r.plate}</span>
                      <FileText className="ml-auto h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{(r.vehicles as { modelo: string | null } | null)?.modelo ?? "—"}</div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span>{new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                      <span className={r.damage_count ? "rounded bg-destructive px-1.5 text-destructive-foreground" : "rounded bg-success px-1.5 text-success-foreground"}>
                        {r.damage_count} avarias
                      </span>
                    </div>
                  </Link>
                ))}
                {!list.length && <p className="p-2 text-center text-xs text-muted-foreground">Nenhuma vistoria neste tipo de operação.</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
