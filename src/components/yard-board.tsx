import { Maximize2, Minimize2, LogIn, AlertTriangle, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDuration, elapsedSince, type YardAppointment } from "@/lib/yard-utils";
import { formatDateBR } from "@/lib/agenda-safety";
import {
  referenceTime,
  type BoardColumnKey,
  type BoardConfig,
  type CardField,
  workType,
} from "@/lib/yard-board";

function fieldValue(item: YardAppointment, f: CardField): string {
  switch (f) {
    case "model":
      return [item.brand, item.model].filter(Boolean).join(" ");
    case "store":
      return item.store;
    case "contact":
      return item.contact;
    case "issue":
      return item.issue;
    case "note":
      return item.note;
    case "operator":
      return item.operator;
    case "deadline":
      return item.currentDeadline ? formatDateBR(item.currentDeadline) : "";
    case "workshop":
      return item.workshop;
  }
}

const FIELD_PREFIX: Partial<Record<CardField, string>> = {
  store: "Loja: ",
  contact: "Contato: ",
  operator: "Mecânico: ",
  deadline: "Previsão: ",
  note: "Obs: ",
};

/** Tela principal da oficina: chegando, em execução e prontos, pensada para telão. */
export function YardBoard({
  board,
  config,
  now,
  senders,
  highlight,
  onCheckIn,
  onDetails,
}: {
  board: Record<BoardColumnKey, YardAppointment[]>;
  config: BoardConfig;
  now: number;
  senders: Record<string, string>;
  highlight: Set<string>;
  onCheckIn: (item: YardAppointment) => void;
  onDetails: (item: YardAppointment) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tv, setTv] = useState(false);
  useEffect(() => {
    const on = () => setTv(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const [urgentOpen, setUrgentOpen] = useState(true);
  const keys = (Object.keys(config.columns) as BoardColumnKey[]).filter(
    (k) => config.columns[k].visible,
  );
  const urgent = keys.flatMap((k) =>
    board[k].filter((i) => i.priorityUrgent).map((i) => ({ i, k })),
  );
  const rest = (k: BoardColumnKey) => board[k].filter((i) => !i.priorityUrgent);
  const filled = keys.filter((k) => rest(k).length > 0);
  const empty = keys.filter((k) => rest(k).length === 0);

  const card = (item: YardAppointment, key: BoardColumnKey) => (
    <article
      key={item.dbId}
      role="button"
      tabIndex={0}
      onClick={() => onDetails(item)}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onDetails(item))
      }
      title="Abrir agendamento"
      className={cn(
        "cursor-pointer rounded-md border bg-card p-3 text-card-foreground transition-colors hover:border-primary hover:bg-muted/40",
        highlight.has(item.dbId) && "animate-pulse border-primary ring-2 ring-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("font-mono font-bold", tv ? "text-3xl" : "text-lg")}>{item.plate}</span>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {item.priorityUrgent && (
            <span className="inline-flex items-center gap-1 rounded bg-destructive px-1.5 py-0.5 text-xs font-semibold text-destructive-foreground">
              <AlertTriangle className="size-3" /> Urgente
            </span>
          )}
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {workType(item.issue)}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {item.status || "Sem situação"}
          </span>
        </div>
      </div>
      <p className={cn("mt-1 text-muted-foreground", tv ? "text-lg" : "text-xs")}>
        {formatDuration(elapsedSince(referenceTime(item), now))}
        {key === "arriving"
          ? ` desde o envio${senders[item.dbId] ? ` · enviado por ${senders[item.dbId]}` : ""}`
          : " no local"}
      </p>
      {config.cardFields.map((f) => {
        const v = fieldValue(item, f);
        return v ? (
          <p key={f} className={cn("truncate", tv ? "text-lg" : "text-sm")}>
            {FIELD_PREFIX[f] ?? ""}
            {v}
          </p>
        ) : null;
      })}
      {key === "arriving" && (
        <Button
          size="sm"
          className="mt-2 w-full"
          onClick={(e) => {
            e.stopPropagation();
            onCheckIn(item);
          }}
        >
          <LogIn className="size-4" /> Dar entrada
        </Button>
      )}
    </article>
  );

  const grid = { gridTemplateColumns: `repeat(auto-fill, minmax(${tv ? 22 : 16}rem, 1fr))` };

  return (
    <div ref={ref} className={cn("space-y-3 bg-background", tv && "overflow-auto p-6")}>
      <div className="flex flex-wrap items-center gap-2">
        {empty.map((k) => (
          <span
            key={k}
            className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground"
          >
            {config.columns[k].label} · 0
          </span>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() =>
            tv ? void document.exitFullscreen() : void ref.current?.requestFullscreen()
          }
        >
          {tv ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          {tv ? "Sair do modo telão" : "Modo telão"}
        </Button>
      </div>
      {urgent.length > 0 && (
        <section className="rounded-lg border border-destructive/40 bg-destructive/5">
          <button
            type="button"
            onClick={() => setUrgentOpen((o) => !o)}
            aria-expanded={urgentOpen}
            className={cn(
              "flex w-full items-center gap-2 px-4 py-2.5 text-left font-bold text-destructive",
              tv ? "text-2xl" : "text-base",
            )}
          >
            <AlertTriangle className="size-4" /> Urgentes
            <span className="rounded-full bg-background px-2 py-0.5 text-sm">{urgent.length}</span>
            <ChevronDown
              className={cn("ml-auto size-4 transition-transform", urgentOpen && "rotate-180")}
            />
          </button>
          {urgentOpen && (
            <div className="grid gap-2 border-t p-3" style={grid}>
              {urgent.map(({ i, k }) => card(i, k))}
            </div>
          )}
        </section>
      )}
      {filled.map((key) => (
        <section key={key} className="rounded-lg border bg-muted/30">
          <h2
            className={cn(
              "flex items-center justify-between border-b px-4 py-2.5 font-bold",
              tv ? "text-2xl" : "text-base",
              key === "arriving" && "text-primary",
            )}
          >
            {config.columns[key].label}
            <span className="rounded-full bg-background px-2 py-0.5 text-sm">
              {rest(key).length}
            </span>
          </h2>
          <div className="grid gap-2 p-3" style={grid}>
            {rest(key).map((item) => card(item, key))}
          </div>
        </section>
      ))}
      {!filled.length && !urgent.length && (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum veículo.</p>
      )}
    </div>
  );
}
