import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PlateCombobox } from "@/components/plate-combobox";
import { diffAnswers, STATUS_LABEL, type CheckStatus } from "@/lib/vistoria";

export const Route = createFileRoute("/vistoria/placa")({
  validateSearch: (s: Record<string, unknown>) => ({ placa: typeof s.placa === "string" ? s.placa : undefined }),
  head: () => ({
    meta: [
      { title: "Localizar por placa | ANPEXC Vistorias" },
      { name: "description", content: "Linha do tempo e comparação das vistorias de um veículo." },
      { property: "og:title", content: "Localizar por placa | ANPEXC Vistorias" },
      { property: "og:description", content: "Linha do tempo e comparação das vistorias de um veículo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Placa,
});

function Placa() {
  const search = Route.useSearch();
  const [plate, setPlate] = useState<string | null>(search.placa ?? null);
  const [pick, setPick] = useState<string[]>([]);
  const list = useQuery({
    queryKey: ["inspections", "plate", plate],
    enabled: !!plate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("id,number,operation_name,status,damage_count,km,created_at")
        .eq("plate", plate!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const cmp = useQuery({
    queryKey: ["inspections", "compare", pick],
    enabled: pick.length === 2,
    queryFn: async () => {
      const { data } = await supabase.from("inspection_answers").select("inspection_id,label,status,kind").in("inspection_id", pick);
      const a = (data ?? []).filter((x) => x.inspection_id === pick[1] && x.kind === "check");
      const b = (data ?? []).filter((x) => x.inspection_id === pick[0] && x.kind === "check");
      return { a, b, diff: diffAnswers(a, b) };
    },
  });
  const toggle = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Localizar por placa</h1>
      <PlateCombobox value={plate} onChange={(p) => (setPlate(p), setPick([]))} />
      {plate && (
        <ol className="space-y-2">
          {list.data?.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 text-sm">
              <input type="checkbox" className="h-5 w-5" checked={pick.includes(i.id)} onChange={() => toggle(i.id)} aria-label="Comparar" />
              <Link to="/vistoria/$id" params={{ id: i.id }} className="flex-1">
                <div className="font-medium">#{i.number} · {i.operation_name}</div>
                <div className="text-muted-foreground">{new Date(i.created_at).toLocaleString("pt-BR")} · KM {i.km ?? "—"} {i.status === "cancelada" && "· Cancelada"}</div>
              </Link>
              <span className={i.damage_count ? "font-semibold text-destructive" : "text-success"}>{i.damage_count} avarias</span>
            </li>
          ))}
          {list.data && !list.data.length && <p className="text-sm text-muted-foreground">Nenhuma vistoria para esta placa.</p>}
        </ol>
      )}
      {pick.length === 1 && <p className="text-sm text-muted-foreground">Marque mais uma vistoria para comparar.</p>}
      {cmp.data && (
        <section className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-center"><h2 className="font-semibold">Comparação (mais antiga × mais nova)</h2><Button size="sm" variant="ghost" className="ml-auto" onClick={() => setPick([])}>Limpar</Button></div>
          <table className="w-full text-sm">
            <tbody>
              {cmp.data.b.map((r) => {
                const old = cmp.data!.a.find((x) => x.label === r.label);
                const d = cmp.data!.diff.has(r.label);
                return (
                  <tr key={r.label} className={d ? "bg-destructive/10 font-medium text-destructive" : ""}>
                    <td className="px-2 py-1">{r.label}</td>
                    <td className="px-2 py-1">{old?.status ? STATUS_LABEL[old.status as CheckStatus] : "—"}</td>
                    <td className="px-2 py-1">{r.status ? STATUS_LABEL[r.status as CheckStatus] : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
