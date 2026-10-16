import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarClock, CarFront, ClipboardList, TriangleAlert, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardDetailDialog, type DetailColumn } from "@/components/dashboard-detail";
import { useChartColors } from "@/components/layout/chart-colors";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dash, formatDateBR } from "@/lib/agenda-safety";
import {
  hasSelection,
  isSelected,
  removeValue,
  selectionChips,
  setValues,
  toggleSelect,
  type DashDim,
  type DashSelection,
} from "@/lib/dashboard-filter";
import { osDate } from "@/lib/os";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | ANPEXC" },
      {
        name: "description",
        content: "Visão geral da frota, agenda e ordens de serviço da ANPEXC.",
      },
      { property: "og:title", content: "Dashboard | ANPEXC" },
      {
        property: "og:description",
        content: "Visão geral da frota, agenda e ordens de serviço da ANPEXC.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardHome,
});

const FALLBACK_COLOR = "oklch(0.51 0.13 252)";
const EMPTY = "Não informado";
const CHART_HINT = "Clique para filtrar · Ctrl/Cmd+Clique para mais de um · Esc limpa";

type Kind = "" | "vehicles" | "appts" | "os" | "overdue";

type VehicleRow = {
  plate: string;
  modelo: string | null;
  fabricante: string | null;
  categoria: string | null;
  status: string | null;
  cor: string | null;
  ano: number | null;
  km_atual: number | null;
};

type ApptRow = {
  date: string | null;
  status: string | null;
  rework_of: string | null;
  plate: string;
  model: string;
  contact: string;
  issue: string;
};

type OsRow = {
  id: string;
  numero: number;
  plate: string | null;
  opened_at: string;
  status_id: number;
  workshop_id: string | null;
};

type OverdueRow = {
  id: string;
  plate: string | null;
  model: string | null;
  contact: string | null;
  current_deadline: string | null;
};

type DashData = {
  vehicleRows: VehicleRow[];
  apptRows: ApptRow[];
  osRows: OsRow[];
  overdueRows: OverdueRow[];
  apptsTotal: number;
  reworks: number;
  osOpen: number;
  osTotal: number;
  overdueCount: number;
  statusMap: Record<number, { label: string; color: string | null }>;
  workshopMap: Record<string, string>;
};

function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function fmt(value: unknown): string {
  const n = Number(value);
  return (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR");
}

/** Dia no formato do gráfico (dd/mm); vazio quando a linha não tem data. */
function dayOf(date: unknown): string {
  const iso = typeof date === "string" ? date.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return EMPTY;
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** Exporta a seleção (ou tudo) para Excel sem colunas técnicas. */
async function exportRows(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name.slice(0, 30));
  XLSX.writeFile(book, `${name}.xlsx`);
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  onClick,
}: {
  icon: typeof CarFront;
  label: string;
  value: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full cursor-pointer rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:border-primary hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground group-hover:text-foreground">
            {label}
          </p>
          <p className="text-3xl font-bold text-kpi-number">{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>}
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary transition-colors group-hover:bg-primary/20">
          <Icon className="size-5 text-secondary-foreground group-hover:text-primary" />
        </span>
      </div>
    </button>
  );
}

function statusBadgeStyle(color: string | null): { style: CSSProperties; className: string } {
  const hex =
    typeof color === "string" && /^[0-9a-f]{6}$/i.test(color.replace("#", ""))
      ? color.replace("#", "")
      : null;
  if (!hex) return { style: {}, className: "bg-secondary text-secondary-foreground" };
  return { style: { backgroundColor: `#${hex}26`, color: `#${hex}` }, className: "" };
}

function DashboardHome() {
  const chartColors = useChartColors(5);
  const [sel, setSel] = useState<DashSelection>({});
  const [kind, setKind] = useState<Kind>("");
  const [picked, setPicked] = useState<string[]>([]);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-home"],
    queryFn: async (): Promise<DashData> => {
      const today = todayBR();
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const [
        completion,
        appts,
        overdueCount,
        overdue,
        osStatus,
        osOpen,
        osTotal,
        recent,
        workshops,
      ] = await Promise.all([
        supabase.from("status_options").select("label").eq("is_completion", true),
        supabase
          .from("appointments")
          .select("date, status, rework_of, plate, model, contact, issue")
          .gte("date", since)
          .is("archived_at", null),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .is("archived_at", null)
          .lt("current_deadline", today),
        supabase
          .from("appointments")
          .select("id, plate, model, contact, current_deadline, status")
          .is("archived_at", null)
          .lt("current_deadline", today)
          .limit(200),
        supabase.from("os_status").select("id, label, color").order("sort_order"),
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .is("archived_at", null)
          .is("closed_at", null),
        supabase
          .from("ordens_servico")
          .select("id", { count: "exact", head: true })
          .is("archived_at", null),
        supabase
          .from("ordens_servico")
          .select("id, numero, plate, opened_at, status_id, workshop_id")
          .is("archived_at", null)
          .order("opened_at", { ascending: false })
          .limit(200),
        supabase.from("workshops").select("id, name"),
      ]);
      const errors = [
        completion,
        appts,
        overdueCount,
        overdue,
        osStatus,
        osOpen,
        osTotal,
        recent,
        workshops,
      ].map((res) => res.error);
      if (errors.some(Boolean)) throw errors.find(Boolean);

      // A frota passa de 1.000 linhas: busca em blocos para não cortar a contagem.
      const vehicleRows: VehicleRow[] = [];
      for (let from = 0; from < 10_000; from += 1000) {
        const res = await supabase
          .from("vehicles")
          .select("plate, modelo, fabricante, categoria, status, cor, ano, km_atual")
          .eq("active", true)
          .order("plate")
          .range(from, from + 999);
        if (res.error) throw res.error;
        const batch = (res.data ?? []) as VehicleRow[];
        vehicleRows.push(...batch);
        if (batch.length < 1000) break;
      }

      const completionLabels = (completion.data ?? []).map((row) => row.label);
      const statusMap: DashData["statusMap"] = {};
      for (const row of osStatus.data ?? [])
        statusMap[row.id] = { label: row.label, color: row.color };
      const workshopMap: DashData["workshopMap"] = {};
      for (const row of workshops.data ?? []) workshopMap[row.id] = row.name;

      const apptRows = (appts.data ?? []) as ApptRow[];
      return {
        vehicleRows,
        apptRows,
        osRows: (recent.data ?? []) as OsRow[],
        overdueRows: (overdue.data ?? [])
          .filter((row) => !row.status || !completionLabels.includes(row.status))
          .map(({ id, plate, model, contact, current_deadline }) => ({
            id,
            plate,
            model,
            contact,
            current_deadline,
          })) as OverdueRow[],
        apptsTotal: apptRows.length,
        reworks: apptRows.filter((row) => row.rework_of).length,
        osOpen: osOpen.count ?? 0,
        osTotal: osTotal.count ?? 0,
        overdueCount: overdueCount.count ?? 0,
        statusMap,
        workshopMap,
      };
    },
  });

  // Esc limpa a seleção dos gráficos (o pop-up aberto cuida de si mesmo).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!kind && event.key === "Escape" && hasSelection(sel)) setSel({});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, kind]);

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
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
      >
        <span>Não foi possível carregar o dashboard.</span>
        <button type="button" className="underline" onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const vehicles = data.vehicleRows;
  const appts = data.apptRows;
  const matchVehicle = (plate: unknown) =>
    !hasSelection(sel, "vehicle") || isSelected(sel, "vehicle", dash(plate));
  const matchSituation = (status: unknown) =>
    !hasSelection(sel, "situation") || isSelected(sel, "situation", dash(status));
  const matchDay = (date: unknown) =>
    !hasSelection(sel, "day") || isSelected(sel, "day", dayOf(date));

  const vehiclesShown = vehicles.filter(
    (row) => matchVehicle(row.plate) && matchSituation(row.status),
  );
  const apptsShown = appts.filter((row) => matchVehicle(row.plate) && matchDay(row.date));
  const own = vehiclesShown.filter((row) => dash(row.status) === "Próprio").length;
  const financed = vehiclesShown.filter((row) => dash(row.status).startsWith("Alienado")).length;
  const reworksShown = apptsShown.filter((row) => row.rework_of).length;
  const overdueShown = hasSelection(sel, "vehicle")
    ? data.overdueRows.filter((row) => matchVehicle(row.plate)).length
    : data.overdueCount;

  // Cada gráfico mostra todos os itens dele; os não marcados ficam esmaecidos.
  const barsSource = appts.filter((row) => matchVehicle(row.plate) && row.date);
  const dayCounts = new Map<string, { dia: string; total: number; sort: string }>();
  for (const row of barsSource) {
    const iso = String(row.date).slice(0, 10);
    const key = dayOf(row.date);
    const hit = dayCounts.get(key);
    if (hit) hit.total += 1;
    else dayCounts.set(key, { dia: key, total: 1, sort: iso });
  }
  const bars = [...dayCounts.values()].sort((a, b) => a.sort.localeCompare(b.sort));

  const situationCounts = new Map<string, number>();
  for (const row of vehicles) {
    if (!matchVehicle(row.plate)) continue;
    const key = dash(row.status);
    situationCounts.set(key, (situationCounts.get(key) ?? 0) + 1);
  }
  const donut = [...situationCounts.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const fade = (dim: DashDim, value: string) =>
    hasSelection(sel, dim) && !isSelected(sel, dim, value) ? 0.25 : 1;
  const pick = (dim: DashDim, value: string, additive = false) =>
    setSel((current) => toggleSelect(current, dim, value, additive));
  const open = (next: Kind) => {
    setPicked(sel.vehicle ?? []);
    setKind(next);
  };
  const close = () => setKind("");
  const applyPicked = (ids: string[]) => {
    setSel((current) => setValues(current, "vehicle", ids));
    close();
  };

  const tooltipStyle = {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
  } as const;

  const vehicleColumns: DetailColumn<VehicleRow>[] = [
    { key: "plate", label: "Placa" },
    { key: "modelo", label: "Modelo" },
    { key: "fabricante", label: "Montadora" },
    { key: "status", label: "Situação" },
    { key: "categoria", label: "Categoria" },
    { key: "ano", label: "Ano", numeric: true },
    { key: "km_atual", label: "KM", numeric: true },
  ];
  const apptColumns: DetailColumn<ApptRow>[] = [
    { key: "plate", label: "Placa" },
    { key: "model", label: "Modelo" },
    { key: "date", label: "Data", format: (value) => (value ? formatDateBR(value) : EMPTY) },
    { key: "contact", label: "Contato" },
    { key: "issue", label: "Serviço" },
    { key: "status", label: "Situação" },
  ];
  const osColumns: DetailColumn<OsRow>[] = [
    { key: "numero", label: "Nº", format: (value) => `#${fmt(value)}` },
    { key: "plate", label: "Placa" },
    { key: "opened_at", label: "Abertura", format: (value) => osDate(value) },
    {
      key: "status_id",
      label: "Situação",
      format: (_value, row) => data.statusMap[row.status_id]?.label ?? EMPTY,
    },
    {
      key: "workshop_id",
      label: "Oficina",
      format: (_value, row) => (row.workshop_id && data.workshopMap[row.workshop_id]) || EMPTY,
    },
  ];
  const overdueColumns: DetailColumn<OverdueRow>[] = [
    { key: "plate", label: "Placa" },
    { key: "model", label: "Modelo" },
    { key: "contact", label: "Contato" },
    {
      key: "current_deadline",
      label: "Previsão",
      format: (value) => osDate(value),
    },
  ];

  function pickIds<T extends { plate: unknown }>(rows: T[], ids: string[]) {
    return ids.length ? rows.filter((row) => ids.includes(dash(row.plate))) : rows;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão geral da frota, agenda e ordens de serviço.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={CarFront}
          label="Veículos ativos"
          value={fmt(vehiclesShown.length)}
          sub={`Próprio ${fmt(own)} · Alienado ${fmt(financed)}`}
          onClick={() => open("vehicles")}
        />
        <Kpi
          icon={CalendarClock}
          label="Agendamentos · 30 dias"
          value={fmt(apptsShown.length)}
          sub={`${fmt(reworksShown)} retrabalho(s)`}
          onClick={() => open("appts")}
        />
        <Kpi
          icon={ClipboardList}
          label="O.S. em aberto"
          value={fmt(data.osOpen)}
          sub={`${fmt(data.osTotal)} no total`}
          onClick={() => open("os")}
        />
        <Kpi
          icon={TriangleAlert}
          label="Prazos vencidos"
          value={fmt(overdueShown)}
          sub="Previsão de Entrega no passado"
          onClick={() => open("overdue")}
        />
      </div>

      {hasSelection(sel) && (
        <section
          aria-label="Filtros aplicados"
          className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3"
        >
          <span className="text-sm font-medium">Filtrando por</span>
          {selectionChips(sel).map((chip) => (
            <Button
              key={`${chip.dim}:${chip.value}`}
              variant="secondary"
              size="sm"
              className="min-h-11 gap-2"
              onClick={() => setSel(removeValue(sel, chip.dim, chip.value))}
            >
              {chip.label}
              <X className="size-3.5" />
              <span className="sr-only">remover</span>
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setSel({})}>
            Limpar tudo
          </Button>
        </section>
      )}

      {data.overdueCount > 0 && (
        <div role="alert" className="rounded-lg border border-accent/40 bg-accent/10 p-4">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-accent-warm-foreground" />
            <p className="text-sm font-semibold">
              {fmt(data.overdueCount)} agendamento(s) com Previsão de Entrega vencida
            </p>
          </div>
          {data.overdueRows.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {data.overdueRows.slice(0, 6).map((row) => (
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
          <p className="text-xs text-muted-foreground">Últimos 30 dias · {CHART_HINT}</p>
          {bars.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Sem agendamentos no período.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={bars}
                margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
                onClick={(state, event) => {
                  const active = (
                    state as { activePayload?: { payload?: { dia?: string } }[] } | undefined
                  )?.activePayload?.[0]?.payload;
                  const keys = event as { ctrlKey?: boolean; metaKey?: boolean } | undefined;
                  if (active?.dia) pick("day", active.dia, Boolean(keys?.ctrlKey || keys?.metaKey));
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} />
                <Bar dataKey="total" name="Agendamentos" radius={[3, 3, 0, 0]}>
                  {bars.map((row) => (
                    <Cell
                      key={row.dia}
                      fill={chartColors[0] || FALLBACK_COLOR}
                      fillOpacity={fade("day", row.dia)}
                      cursor="pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">Veículos por situação</h2>
          <p className="text-xs text-muted-foreground">Frota ativa · {CHART_HINT}</p>
          {donut.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              Sem veículos cadastrados.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Pie
                    data={donut}
                    dataKey="total"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    onClick={(entry, _index, event) => {
                      const name = (entry as { name?: string } | undefined)?.name;
                      const keys = event as { ctrlKey?: boolean; metaKey?: boolean } | undefined;
                      if (name) pick("situation", name, Boolean(keys?.ctrlKey || keys?.metaKey));
                    }}
                  >
                    {donut.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={chartColors[index % chartColors.length] || FALLBACK_COLOR}
                        stroke="var(--card)"
                        fillOpacity={fade("situation", entry.name)}
                        cursor="pointer"
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 flex flex-wrap justify-center gap-1 text-xs text-muted-foreground">
                {donut.map((entry, index) => (
                  <li key={entry.name}>
                    <button
                      type="button"
                      onClick={(event) =>
                        pick("situation", entry.name, event.ctrlKey || event.metaKey)
                      }
                      className={cn(
                        "flex min-h-11 items-center gap-1.5 rounded-md px-2 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isSelected(sel, "situation", entry.name) &&
                          "bg-accent/50 font-semibold text-foreground",
                        fade("situation", entry.name) < 1 && "opacity-40",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            chartColors[index % chartColors.length] || FALLBACK_COLOR,
                        }}
                      />
                      {entry.name} ({fmt(entry.total)})
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card shadow-sm">
        <h2 className="px-4 pt-4 text-base font-semibold">Últimas O.S. abertas</h2>
        {data.osRows.filter((row) => matchVehicle(row.plate)).length === 0 ? (
          <p className="px-4 pb-6 pt-4 text-sm text-muted-foreground">
            Nenhuma ordem de serviço encontrada.
          </p>
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
              {data.osRows
                .filter((row) => matchVehicle(row.plate))
                .slice(0, 8)
                .map((row) => {
                  const status = data.statusMap[row.status_id];
                  const badge = statusBadgeStyle(status?.color ?? null);
                  return (
                    <TableRow key={row.id} className="hover:bg-row-hover">
                      <TableCell className="px-4 font-medium">
                        <Link
                          to="/ordens-servico/$id"
                          params={{ id: row.id }}
                          className="hover:underline"
                        >
                          #{row.numero.toLocaleString("pt-BR")}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {row.plate ? (
                          <Link
                            to="/veiculo/$plate"
                            params={{ plate: row.plate }}
                            className="font-medium hover:underline"
                          >
                            {row.plate}
                          </Link>
                        ) : (
                          EMPTY
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-52 truncate sm:table-cell">
                        {(row.workshop_id && data.workshopMap[row.workshop_id]) || EMPTY}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                          style={badge.style}
                        >
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

      {kind === "vehicles" && (
        <DashboardDetailDialog
          open
          onOpenChange={(next) => !next && close()}
          title="Veículos ativos"
          description="Pesquise por placa, modelo ou situação e marque um, alguns ou todos os carros."
          rows={vehicles}
          columns={vehicleColumns}
          searchKeys={["plate", "modelo", "fabricante", "status", "categoria", "cor"]}
          searchPlaceholder="Buscar placa, modelo, montadora…"
          getId={(row) => dash(row.plate)}
          selected={picked}
          onSelectedChange={setPicked}
          onApply={applyPicked}
          onExport={(ids) =>
            void exportRows(
              "veiculos",
              pickIds(vehicles, ids).map((row) => ({
                Placa: row.plate,
                Modelo: row.modelo ?? "",
                Montadora: row.fabricante ?? "",
                Situação: row.status ?? "",
                Categoria: row.categoria ?? "",
                Cor: row.cor ?? "",
                Ano: row.ano ?? "",
                KM: row.km_atual ?? "",
              })),
            )
          }
        />
      )}

      {kind === "appts" && (
        <DashboardDetailDialog
          open
          onOpenChange={(next) => !next && close()}
          title="Agendamentos dos últimos 30 dias"
          description="Pesquise por placa, contato ou serviço e marque os agendamentos desejados."
          rows={appts}
          columns={apptColumns}
          searchKeys={["plate", "model", "contact", "issue", "status"]}
          searchPlaceholder="Buscar placa, contato, serviço…"
          getId={(row) => dash(row.plate)}
          selected={picked}
          onSelectedChange={setPicked}
          onApply={applyPicked}
          onExport={(ids) =>
            void exportRows(
              "agendamentos",
              pickIds(appts, ids).map((row) => ({
                Placa: row.plate,
                Modelo: row.model,
                Data: row.date ? formatDateBR(row.date) : "",
                Contato: row.contact,
                Serviço: row.issue,
                Situação: row.status ?? "",
                Retrabalho: row.rework_of ? "Sim" : "Não",
              })),
            )
          }
        />
      )}

      {kind === "os" && (
        <DashboardDetailDialog
          open
          onOpenChange={(next) => !next && close()}
          title="Ordens de serviço abertas"
          description="As O.S. mais recentes. Pesquise por placa ou número e marque os carros desejados."
          rows={data.osRows}
          columns={osColumns}
          searchKeys={["plate", "numero"]}
          searchPlaceholder="Buscar placa ou número da O.S.…"
          getId={(row) => dash(row.plate)}
          selected={picked}
          onSelectedChange={setPicked}
          onApply={applyPicked}
          applyLabel="Filtrar painel por estes carros"
          onExport={(ids) =>
            void exportRows(
              "ordens-de-servico",
              pickIds(data.osRows, ids).map((row) => ({
                Nº: row.numero,
                Placa: row.plate ?? "",
                Abertura: osDate(row.opened_at),
                Situação: data.statusMap[row.status_id]?.label ?? "",
                Oficina: (row.workshop_id && data.workshopMap[row.workshop_id]) || "",
              })),
            )
          }
        />
      )}

      {kind === "overdue" && (
        <DashboardDetailDialog
          open
          onOpenChange={(next) => !next && close()}
          title="Previsão de Entrega vencida"
          description="Agendamentos sem conclusão com prazo no passado. Pesquise e marque os carros desejados."
          rows={data.overdueRows}
          columns={overdueColumns}
          searchKeys={["plate", "model", "contact"]}
          searchPlaceholder="Buscar placa, modelo, contato…"
          getId={(row) => dash(row.plate)}
          selected={picked}
          onSelectedChange={setPicked}
          onApply={applyPicked}
          onExport={(ids) =>
            void exportRows(
              "prazos-vencidos",
              pickIds(data.overdueRows, ids).map((row) => ({
                Placa: row.plate ?? "",
                Modelo: row.model ?? "",
                Contato: row.contact ?? "",
                Previsão: osDate(row.current_deadline),
              })),
            )
          }
        />
      )}
    </div>
  );
}
