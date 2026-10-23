import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOperationTypes } from "@/lib/vistoria-data";

export const Route = createFileRoute("/vistoria/lista")({
  head: () => ({
    meta: [
      { title: "Vistorias | ANPEXC Vistorias" },
      { name: "description", content: "Lista de vistorias com filtros e exportação." },
      { property: "og:title", content: "Vistorias | ANPEXC Vistorias" },
      { property: "og:description", content: "Lista de vistorias com filtros e exportação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lista,
});

const PAGE = 50;

function Lista() {
  const ops = useOperationTypes();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [plate, setPlate] = useState("");
  const [op, setOp] = useState("");
  const [status, setStatus] = useState("");
  const [damage, setDamage] = useState("");
  const [page, setPage] = useState(0);
  const q = useQuery({
    queryKey: ["inspections", "list", from, to, plate, op, status, damage, page],
    queryFn: async () => {
      let s = supabase
        .from("inspections")
        .select(
          "id,number,plate,operation_name,status,km,damage_count,client_name,created_at,inspector_id",
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (from) s = s.gte("created_at", `${from}T00:00:00-03:00`);
      if (to) s = s.lte("created_at", `${to}T23:59:59-03:00`);
      if (plate.trim()) s = s.ilike("plate", `%${plate.trim().toUpperCase()}%`);
      if (op) s = s.eq("operation_type_id", op);
      if (status) s = s.eq("status", status);
      if (damage === "com") s = s.gt("damage_count", 0);
      if (damage === "sem") s = s.eq("damage_count", 0);
      const { data, error, count } = await s;
      if (error) throw error;
      return { rows: data, count: count ?? 0 };
    },
  });
  const ids = useMemo(
    () => [...new Set((q.data?.rows ?? []).map((r) => r.inspector_id))],
    [q.data],
  );
  const names = useQuery({
    queryKey: ["profiles-names", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name").in("id", ids);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name ?? "—"]));
    },
  });
  const rows = q.data?.rows ?? [];
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.operation_name ?? "—", (m.get(r.operation_name ?? "—") ?? 0) + 1));
    return [...m];
  }, [rows]);
  function exportCsv() {
    const head = [
      "Nº",
      "Data",
      "Placa",
      "Operação",
      "KM",
      "Avarias",
      "Cliente",
      "Vistoriador",
      "Status",
    ];
    const lines = rows.map((r) =>
      [
        r.number,
        new Date(r.created_at).toLocaleString("pt-BR"),
        r.plate,
        r.operation_name ?? "",
        r.km ?? "",
        r.damage_count,
        r.client_name ?? "",
        names.data?.[r.inspector_id] ?? "",
        r.status,
      ]
        .map((v) => {
          const s = typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        })
        .join(";"),
    );
    const blob = new Blob(["\ufeff" + [head.join(";"), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "vistorias.csv";
    a.click();
  }
  const sel = "h-10 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Vistorias</h1>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={exportCsv}
          disabled={!rows.length}
        >
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 md:grid-cols-6">
        <Input
          type="date"
          value={from}
          onChange={(e) => (setFrom(e.target.value), setPage(0))}
          aria-label="De"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => (setTo(e.target.value), setPage(0))}
          aria-label="Até"
        />
        <Input
          placeholder="Placa"
          value={plate}
          onChange={(e) => (setPlate(e.target.value), setPage(0))}
        />
        <select className={sel} value={op} onChange={(e) => (setOp(e.target.value), setPage(0))}>
          <option value="">Todas operações</option>
          {ops.data?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          className={sel}
          value={status}
          onChange={(e) => (setStatus(e.target.value), setPage(0))}
        >
          <option value="">Todos status</option>
          <option value="concluida">Concluída</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <select
          className={sel}
          value={damage}
          onChange={(e) => (setDamage(e.target.value), setPage(0))}
        >
          <option value="">Com e sem avaria</option>
          <option value="com">Com avaria</option>
          <option value="sem">Sem avaria</option>
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              {["Nº", "Data", "Placa", "Operação", "Avarias", "Vistoriador", "Status"].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2">
                  <Link to="/vistoria/$id" params={{ id: r.id }} className="font-medium text-link">
                    #{r.number}
                  </Link>
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-3 py-2">
                  <span className="rounded border bg-white px-1.5 font-mono font-bold text-black">
                    {r.plate}
                  </span>
                </td>
                <td className="px-3 py-2">{r.operation_name ?? "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={r.damage_count ? "font-semibold text-destructive" : "text-success"}
                  >
                    {r.damage_count}
                  </span>
                </td>
                <td className="px-3 py-2">{names.data?.[r.inspector_id] ?? "—"}</td>
                <td className="px-3 py-2">
                  {r.status === "cancelada" ? (
                    <span className="text-destructive">Cancelada</span>
                  ) : (
                    "Concluída"
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  {q.isLoading ? "Carregando…" : "Nenhuma vistoria encontrada."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">{q.data?.count ?? 0} vistoria(s)</span>
        {totals.map(([k, v]) => (
          <span key={k} className="rounded bg-muted px-2 py-0.5 text-xs">
            {k}: {v}
          </span>
        ))}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={(page + 1) * PAGE >= (q.data?.count ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
