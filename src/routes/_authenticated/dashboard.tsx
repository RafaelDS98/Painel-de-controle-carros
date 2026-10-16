import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, CarFront, ClipboardList, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useChartColors } from "@/components/layout/chart-colors";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { osDate } from "@/lib/os";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | ANPEXC" },
      { name: "description", content: "Visão geral da frota, agenda e ordens de serviço da ANPEXC." },
      { property: "og:title", content: "Dashboard | ANPEXC" },
      { property: "og:description", content: "Visão geral da frota, agenda e ordens de serviço da ANPEXC." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardHome,
});

const FALLBACK_COLOR = "oklch(0.51 0.13 252)";
const EMPTY = "Não informado";

function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function fmt(value: unknown): string {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR");
}

type DashData = {
  vehiclesTotal: number;
  vehiclesByStatus: { name: string; total: number }[];
  apptsTotal: number;
  apptsByDay: { dia: string; total: number }[];
  reworks: number;
  osOpen: number;
  osTotal: number;
  overdueCount: number;
  overdue: { id: string; plate: string | null; current_deadline: string | null }[];
  statusMap: Record<number, { label: string; color: string | null }>;
  workshopMap: Record<string, string>;
  recent: { id: string; numero: number; plate: string | null; opened_at: string; status_id: number; workshop_id: string | null }[];
};

function Kpi({ icon: Icon, label, value, sub }: { icon: typeof CarFront; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-kpi-number">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Icon className="size-5 text-secondary-foreground" />
        </span>
      </div>
    </div>
  );
}

function statusBadgeStyle(color: string | null): { style: React.CSSProperties; className: string } {
  const hex = typeof color === "string" && /^[0-9a-f]{6}$/i.test(color.replace("#", "")) ? color.replace("#", "") : null;
  if (!hex) return { style: {}, className: "bg-secondary text-secondary-foreground" };
  return { style: { backgroundColor: `#${hex}26`, color: `#${hex}` }, className: "" };
}

function DashboardHome() {
  const chartColors = useChartColors(5);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-home"],
    queryFn: async (): Promise<DashData> => {
      const today = todayBR();
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const [completion, vehicles, appts, overdueCount, overdue, osStatus, osOpen, osTotal, recent, workshops] =
        await Promise.all([
          supabase.from("status_options").select("label").eq("is_completion", true),
          supabase.from("vehicles").select("status").eq("active", true),
          supabase.from("appointments").select("date, status, rework_of").gte("date", since).is("archived_at", null),
          supabase
            .from("appointments")
            .select("id", { count: "exact", head: true })
            .is("archived_at", null)
            .lt("current_deadline", today),
          supabase
            .from("appointments")
            .select("id, plate, current_deadline")
            .is("archived_at", null)
            .lt("current_deadline", today)
            .limit(6),
          supabase.from("os_status").select("id, label, color").order("sort_order"),
          supabase.from("ordens_servico").select("id", { count: "exact", head: true }).is("archived_at", null).is("closed_at", null),
          supabase.from("ordens_servico").select("id", { count: "exact", head: true }).is("archived_at", null),
          supabase
            .from("ordens_servico")
            .select("id, numero, plate, opened_at, status_id, workshop_id")
            .is("archived_at", null)
            .order("opened_at", { ascending: false })
            .limit(8),
          supabase.from("workshops").select("id, name"),
        ]);
      const errors = [completion, vehicles, appts, overdueCount, overdue, osStatus, osOpen, osTotal, recent, workshops].map(
        (res) => res.error,
      );
      if (errors.some(Boolean)) throw errors.find(Boolean);

      const completionLabels = (completion.data ?? []).map((row) => row.label);
      const statusMap: DashData["statusMap"] = {};
      for (const row of osStatus.data ?? []) statusMap[row.id] = { label: row.label, color: row.color };
      const workshopMap: DashData["workshopMap"] = {};
      for (const row of workshops.data ?? []) workshopMap[row.id] = row.name;

      const vehicleRows = vehicles.data ?? [];
      const statusCounts = new Map<string, number>();
      for (const row of vehicleRows) {
        const key = row.status || EMPTY;
        statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
      }
      const vehiclesByStatus = [...statusCounts.entries()]
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total);

      const apptRows = (appts.data ?? []) as { date: string | null; status: string | null; rework_of: string | null }[];
      const dayCounts = new Map<string, number>();
      for (const row of apptRows) {
        if (!row.date) continue;
        dayCounts.set(row.date, (dayCounts.get(row.date) ?? 0) + 1);
      }
      const apptsByDay = [...dayCounts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({
          dia: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          total,
        }));

      return {
        vehiclesTotal: vehicleRows.length,
        vehiclesByStatus,
        apptsTotal: apptRows.length,
        apptsByDay,
        reworks: apptRows.filter((row) => row.rework_of).length,
        osOpen: osOpen.count ?? 0,
        osTotal: osTotal.count ?? 0,
        overdueCount: overdueCount.count ?? 0,
        overdue: ((overdue.data ?? []) as DashData["overdue"]).filter((row) => !row.status || !completionLabels.includes(row.status ?? "")) as never,
        recent: (recent.data ?? []) as DashData["recent"],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        <span>Não foi possível carregar o dashboard.</span>
        <button type="button" className="underline" onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const ownVehicles = data.vehiclesByStatus.find((s) => s.name === "Próprio")?.total ?? 0;
  const financed = data.vehiclesByStatus.filter((s) => s.name.startsWith("Alienado")).reduce((sum, s) => sum + s.total, 0);
  const tooltipStyle = { backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" } as const;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão geral da frota, agenda e ordens de serviço.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={CarFront} label="Veículos ativos" value={fmt(data.vehiclesTotal)} sub={`Próprio ${fmt(ownVehicles)} · Alienado ${fmt(financed)}`} />
        <Kpi icon={CalendarClock} label="Agendamentos · 30 dias" value={fmt(data.apptsTotal)} sub={`${fmt(data.reworks)} retrabalho(s)`} />
        <Kpi icon={ClipboardList} label="O.S. em aberto" value={fmt(data.osOpen)} sub={`${fmt(data.osTotal)} no total`} />
        <Kpi icon={TriangleAlert} label="Prazos vencidos" value={fmt(data.overdueCount)} sub="Previsão de Entrega no passado" />
      </div>

      {data.overdueCount > 0 && (
        <div role="alert" className="rounded-lg border border-accent/40 bg-accent/10 p-4">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-accent-warm-foreground" />
            <p className="text-sm font-semibold">
              {fmt(data.overdueCount)} agendamento(s) com Previsão de Entrega vencida
            </p>
          </div>
          {data.overdue.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {data.overdue.map((row) => (
                <li key={row.id}>
                  <Link
                    to="/veiculo/$plate"
                    params={{ plate: row.plate ?? "" }}
                    className="inline-flex rounded-full bg-card px-2.5 py-0.5 text-xs font-medium shadow-sm hover:bg-accent"
                  >
                    {row.plate || EMPTY} · até {osDate(row.current_deadline)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">Agendamentos por dia</h2>
          <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          {data.apptsByDay.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Sem agendamentos no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.apptsByDay} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
                <Bar dataKey="total" name="Agendamentos" fill={chartColors[0] || FALLBACK_COLOR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">Veículos por situação</h2>
          <p className="text-xs text-muted-foreground">Frota ativa</p>
          {data.vehiclesByStatus.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Sem veículos cadastrados.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Pie data={data.vehiclesByStatus} dataKey="total" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {data.vehiclesByStatus.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length] || FALLBACK_COLOR} stroke="var(--card)" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {data.vehiclesByStatus.map((entry, index) => (
                  <li key={entry.name} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] || FALLBACK_COLOR }} />
                    {entry.name} ({fmt(entry.total)})
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card shadow-sm">
        <h2 className="px-4 pt-4 text-base font-semibold">Últimas O.S. abertas</h2>
        {data.recent.length === 0 ? (
          <p className="px-4 pb-6 pt-4 text-sm text-muted-foreground">Nenhuma ordem de serviço encontrada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Nº</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead className="hidden sm:table-cell">Oficina</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right sm:pr-4">Abertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recent.map((row) => {
                const status = data.statusMap[row.status_id];
                const badge = statusBadgeStyle(status?.color ?? null);
                return (
                  <TableRow key={row.id} className="hover:bg-row-hover">
                    <TableCell className="px-4 font-medium">
                      <Link to="/ordens-servico/$id" params={{ id: row.id }} className="hover:underline">
                        #{row.numero.toLocaleString("pt-BR")}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {row.plate ? (
                        <Link to="/veiculo/$plate" params={{ plate: row.plate }} className="font-medium hover:underline">
                          {row.plate}
                        </Link>
                      ) : (
                        EMPTY
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-52 truncate sm:table-cell">{(row.workshop_id && data.workshopMap[row.workshop_id]) || EMPTY}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`} style={badge.style}>
                        {status?.label ?? EMPTY}
                      </span>
                    </TableCell>
                    <TableCell className="text-right sm:pr-4">{osDate(row.opened_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
