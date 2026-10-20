import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizePlate } from "@/lib/normalize";
import {
  checkInExportRows,
  checkInOrigin,
  checkInTypeLabel,
  formatCheckInDate,
  type CheckInRow,
} from "@/lib/check-in-log";
import { toast } from "sonner";

const PAGE = 50;
const SELECT =
  "id,type,occurred_at,plate,note,photo_url,appointment_id,os_number,workshops(name),profiles(full_name)";

type Raw = Omit<CheckInRow, "workshop_name" | "user_name"> & {
  workshops: { name: string } | null;
  profiles: { full_name: string | null } | null;
};
const toRow = (r: Raw): CheckInRow => ({
  ...r,
  workshop_name: r.workshops?.name ?? null,
  user_name: r.profiles?.full_name ?? null,
});

/** Histórico de check-ins/check-outs com filtros, paginação e exportação. */
export function CheckInLog() {
  const [plate, setPlate] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [origin, setOrigin] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<CheckInRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const p = normalizePlate(plate);

  const build = (count: boolean) => {
    let q = supabase.from("check_in_records").select(SELECT, count ? { count: "exact" } : {});
    if (p) q = q.ilike("plate", `%${p}%`);
    if (from) q = q.gte("occurred_at", `${from}T00:00:00-03:00`);
    if (to) q = q.lte("occurred_at", `${to}T23:59:59.999-03:00`);
    if (type) q = q.eq("type", type);
    if (origin === "agendamento") q = q.not("appointment_id", "is", null);
    if (origin === "avulso") q = q.is("appointment_id", null);
    return q.order("occurred_at", { ascending: false });
  };

  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      void build(true)
        .range((page - 1) * PAGE, page * PAGE - 1)
        .then(({ data, count, error: e }) => {
          if (!active) return;
          setError(e ? "Não foi possível carregar os check-ins." : "");
          setRows(((data ?? []) as unknown as Raw[]).map(toRow));
          setTotal(count ?? 0);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, from, to, type, origin, page]);

  async function exportXlsx() {
    const all: CheckInRow[] = [];
    for (let off = 0; off < 20000; off += 1000) {
      const { data, error: e } = await build(false).range(off, off + 999);
      if (e) {
        toast.error("Falha ao exportar.");
        return;
      }
      all.push(...((data ?? []) as unknown as Raw[]).map(toRow));
      if (!data || data.length < 1000) break;
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(checkInExportRows(all)), "Check-ins");
    XLSX.writeFile(wb, "check-ins.xlsx");
  }

  async function openPhoto(path: string) {
    const { data } = await supabase.storage.from("check-in-photos").createSignedUrl(path, 300);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
    else toast.error("Foto indisponível.");
  }

  const sel = "h-10 rounded-md border bg-background px-2 text-sm text-foreground";
  return (
    <section className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">Check-ins e check-outs</h2>
      <div className="flex flex-wrap gap-2">
        <Input
          className="w-36"
          placeholder="Placa"
          value={plate}
          onChange={(e) => {
            setPlate(e.target.value);
            setPage(1);
          }}
        />
        <Input
          className="w-40"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Input className="w-40" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Entrada e saída</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
        <select className={sel} value={origin} onChange={(e) => setOrigin(e.target.value)}>
          <option value="">Toda origem</option>
          <option value="agendamento">Agendamento</option>
          <option value="avulso">Avulso</option>
        </select>
        <Button variant="outline" onClick={() => void exportXlsx()}>
          Exportar Excel
        </Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {[
                "Data/hora",
                "Tipo",
                "Placa",
                "Local",
                "Origem",
                "O.S.",
                "Usuário",
                "Observação",
                "Foto",
              ].map((h) => (
                <th key={h} className="p-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{formatCheckInDate(r.occurred_at)}</td>
                <td className="p-2">{checkInTypeLabel(r.type)}</td>
                <td className="p-2">{r.plate ?? "—"}</td>
                <td className="p-2">{r.workshop_name ?? "—"}</td>
                <td className="p-2">{checkInOrigin(r)}</td>
                <td className="p-2">{r.os_number ?? "—"}</td>
                <td className="p-2">{r.user_name ?? "Usuário excluído"}</td>
                <td className="p-2">{r.note ?? "—"}</td>
                <td className="p-2">
                  {r.photo_url ? (
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => void openPhoto(r.photo_url!)}
                    >
                      Ver
                    </Button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="p-4 text-center text-muted-foreground">
                  Nenhum registro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
        Página {page} de {Math.max(1, Math.ceil(total / PAGE))} · {total} registros
        <Button
          variant="outline"
          size="sm"
          disabled={page * PAGE >= total}
          onClick={() => setPage(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </section>
  );
}
