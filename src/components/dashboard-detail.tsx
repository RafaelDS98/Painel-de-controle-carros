// Pop-up de detalhamento do Dashboard: lista com pesquisa, caixinhas (um, alguns ou todos) e ações.
import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { checkAllState, searchRows, toggleAll, toggleValue } from "@/lib/dashboard-filter";
import { dash } from "@/lib/agenda-safety";

const MAX_ROWS = 300;
const n = (value: number) => value.toLocaleString("pt-BR");

export type DetailColumn<T> = {
  key: keyof T;
  label: string;
  numeric?: boolean;
  format?: (value: T[keyof T], row: T) => string;
};

type Props<T extends object> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  rows: T[];
  columns: DetailColumn<T>[];
  searchKeys: (keyof T)[];
  searchPlaceholder: string;
  getId: (row: T) => string;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onApply?: (ids: string[]) => void;
  applyLabel?: string;
  onExport?: (ids: string[]) => void;
};

/** Lista detalhada com busca por texto e seleção por caixinha (um, alguns ou todos). */
export function DashboardDetailDialog<T extends object>(props: Props<T>) {
  const {
    open,
    onOpenChange,
    title,
    description,
    rows,
    columns,
    searchKeys,
    searchPlaceholder,
    getId,
    selected,
    onSelectedChange,
    onApply,
    applyLabel,
    onExport,
  } = props;
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => searchRows(rows, query, searchKeys), [rows, query, searchKeys]);
  const ids = useMemo(() => filtered.map(getId), [filtered, getId]);
  const allState = checkAllState(ids, selected);
  const shown = filtered.slice(0, MAX_ROWS);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Pesquisar"
              className="pl-9"
            />
          </label>
          <span className="flex min-h-10 shrink-0 items-center gap-2 rounded-md border bg-card px-3 text-sm text-foreground hover:border-primary hover:bg-accent/20">
            <Checkbox
              id="dash-select-all"
              checked={allState === "partial" ? "indeterminate" : allState}
              onCheckedChange={() => onSelectedChange(toggleAll(ids, selected))}
              aria-label="Selecionar todos"
            />
            <label htmlFor="dash-select-all" className="cursor-pointer">
              Selecionar todos ({n(filtered.length)})
            </label>
          </span>
        </div>

        <div className="max-h-[50vh] min-h-32 overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/80 text-left backdrop-blur">
              <tr>
                <th className="w-10 px-3 py-2">
                  <span className="sr-only">Selecionar</span>
                </th>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className={`whitespace-nowrap px-3 py-2 font-medium ${column.numeric ? "text-right" : ""}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, index) => {
                const id = getId(row);
                const on = selected.some((value) => value === id);
                return (
                  <tr key={`${id}-${index}`} className="border-t hover:bg-row-hover">
                    <td className="px-3 py-1.5">
                      <span className="flex min-h-6 items-center">
                        <Checkbox
                          checked={on}
                          onCheckedChange={() => onSelectedChange(toggleValue(selected, id))}
                          aria-label={`Selecionar ${id || "item"}`}
                        />
                      </span>
                    </td>
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className={`max-w-60 truncate px-3 py-1.5 ${column.numeric ? "text-right" : ""}`}
                      >
                        {column.format
                          ? column.format(row[column.key], row)
                          : dash(row[column.key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nada encontrado com {query ? `"${query}"` : "esses termos"}.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {n(filtered.length)} de {n(rows.length)} · {n(selected.length)} selecionado(s)
          {filtered.length > MAX_ROWS && ` · mostrando os ${n(MAX_ROWS)} primeiros`}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          {selected.length > 0 && (
            <Button variant="ghost" onClick={() => onSelectedChange([])}>
              Limpar seleção
            </Button>
          )}
          {onExport && (
            <Button variant="outline" onClick={() => onExport(selected)}>
              <Download />
              Excel
            </Button>
          )}
          {onApply && (
            <Button onClick={() => onApply(selected)} disabled={!selected.length}>
              {applyLabel ?? "Aplicar filtro"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
