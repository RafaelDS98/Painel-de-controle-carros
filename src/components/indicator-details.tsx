import { useState } from "react";
import { ArrowRight, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateBR, foldKey } from "@/lib/agenda-safety";
import { normalizePlate, normalizeTime } from "@/lib/normalize";

export type IndicatorAppointment = {
  dbId: string; plate: string; date: string; time: string; status: string; workshop: string;
  reworkReason?: string | null; original?: string;
};
export type IndicatorGroup = { key: string; label: string; rows: IndicatorAppointment[]; filter?: () => void };

export function IndicatorDetails({ groups, placeholder, onAppointment, onPlate }: {
  groups: IndicatorGroup[]; placeholder: string;
  onAppointment: (id: string) => void; onPlate: (plate: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = groups.filter((group) => group.label === "Não informado" ? foldKey("Não informado").includes(foldKey(query)) :
    placeholder.includes("placa") ? normalizePlate(group.label).includes(normalizePlate(query)) : foldKey(group.label).includes(foldKey(query)));
  return <div className="space-y-3">
    <label className="relative block"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input autoFocus aria-label={placeholder} placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" /></label>
    {!visible.length ? <p className="py-6 text-center text-sm text-muted-foreground">{groups.length ? "Nenhum resultado encontrado." : "Nenhum registro no período."}</p> :
      <ul className="max-h-[55vh] divide-y overflow-y-auto">{visible.map((group) => <li key={group.key} className="py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" aria-expanded={expanded === group.key} onClick={() => setExpanded(expanded === group.key ? null : group.key)} className="min-h-11 min-w-0 flex-1 justify-between gap-2 px-2 text-left text-primary hover:bg-accent/30 hover:text-primary">
            <span className="min-w-0 truncate font-semibold">{group.label}</span><span className="ml-auto shrink-0 text-xs text-muted-foreground">{group.rows.length} agendamento(s)</span><ChevronRight className={`size-4 shrink-0 transition-transform ${expanded === group.key ? "rotate-90" : ""}`} />
          </Button>
          {group.filter && <Button variant="outline" size="sm" className="min-h-11 shrink-0" onClick={group.filter}><ArrowRight className="size-4" />Ver na agenda</Button>}
        </div>
        {expanded === group.key && <ul className="mt-2 space-y-1 border-l pl-3">{group.rows.map((row) => <li key={row.dbId} className="flex flex-wrap items-center gap-1 rounded border-b py-1">
          <Button variant="link" className="min-h-11 min-w-0 px-2 font-bold text-primary" onClick={() => onPlate(row.plate)} title="Histórico do veículo">{row.plate || "Não informado"}<ChevronRight className="size-4" /></Button>
          <Button variant="ghost" className="min-h-11 min-w-0 flex-1 justify-between gap-2 px-2 text-left hover:bg-accent/30" onClick={() => onAppointment(row.dbId)}>
            <span className="min-w-0 text-xs text-foreground">{formatDateBR(row.date)} · {normalizeTime(row.time) || "—"} · {row.status || "Não atualizada"}{row.original ? ` · Original: ${row.original}` : ""}{row.reworkReason ? ` · ${row.reworkReason}` : ""}</span><ChevronRight className="size-4 shrink-0 text-primary" />
          </Button>
        </li>)}</ul>}
      </li>)}</ul>}
  </div>;
}