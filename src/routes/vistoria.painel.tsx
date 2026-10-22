import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { inspectionStats, spDay } from "@/lib/vistoria-stats";

export const Route = createFileRoute("/vistoria/painel")({
  head: () => ({
    meta: [
      { title: "Página inicial | ANPEXC Vistorias" },
      { name: "description", content: "Indicadores, ranking de vistoriadores e últimas vistorias." },
      { property: "og:title", content: "Página inicial | ANPEXC Vistorias" },
      { property: "og:description", content: "Indicadores, ranking de vistoriadores e últimas vistorias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Painel,
});

function Painel() {
  const q = useQuery({
    queryKey: ["inspections", "dashboard"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = `${spDay(new Date(Date.now() - 40 * 86400_000))}T00:00:00-03:00`;
      const all = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("inspections")
          .select("id,number,plate,operation_name,inspector_id,damage_count,created_at,status")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .range(from, from + 999);
        if (error) throw error;
        all.push(...data);
        if (data.length < 1000) break;
      }
      const ids = [...new Set(all.map((r) => r.inspector_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id,full_name").in("id", ids)
        : { data: [] };
      return { rows: all, names: Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? "—"])) };
    },
  });
  const s = useMemo(() => inspectionStats(q.data?.rows ?? [], new Date()), [q.data]);
  const names = q.data?.names ?? {};
  const kpis = [
    ["Hoje", s.today],
    ["No mês", s.month],
    ["Veículos no mês", s.vehicles],
    ["Vistoriadores ativos", s.inspectors],
    ["Com avaria no mês", s.withDamage],
  ] as const;
  const last = (q.data?.rows ?? []).slice(0, 10);
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-semibold">Página inicial</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map(([l, v]) => (
          <div key={l} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className={l.startsWith("Com avaria") && v ? "text-3xl font-bold text-destructive" : "text-3xl font-bold"}>
              {q.isLoading ? "…" : v}
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-medium">Top 5 vistoriadores (mês)</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={s.top.map(([id, total]) => ({ name: names[id] ?? "—", total }))} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis type="category" dataKey="name" width={110} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip />
                <Bar dataKey="total" name="Vistorias" fill="var(--chart-1)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-medium">Últimos 7 dias</h2>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={s.days.map((d) => ({ ...d, label: d.day.slice(8, 10) + "/" + d.day.slice(5, 7) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis allowDecimals={false} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip />
                <Line dataKey="total" name="Vistorias" stroke="var(--chart-2)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="overflow-x-auto rounded-xl border bg-card">
        <h2 className="px-4 pt-4 font-medium">Últimas vistorias</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {last.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">
                  <Link to="/vistoria/$id" params={{ id: r.id }} className="text-link">#{r.number}</Link>
                </td>
                <td className="px-2 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-2 py-2"><span className="rounded border bg-white px-1.5 font-mono font-bold text-black">{r.plate}</span></td>
                <td className="px-2 py-2">{r.operation_name}</td>
                <td className="px-2 py-2">{names[r.inspector_id] ?? "—"}</td>
                <td className="px-2 py-2">
                  {r.status === "cancelada" ? <span className="text-destructive">Cancelada</span> : <span className={r.damage_count ? "text-destructive" : "text-success"}>{r.damage_count} avarias</span>}
                </td>
              </tr>
            ))}
            {!last.length && <tr><td className="px-4 py-6 text-center text-muted-foreground">Nenhuma vistoria ainda.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
