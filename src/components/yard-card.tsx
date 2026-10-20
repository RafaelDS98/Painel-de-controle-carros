import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, ChevronRight, AlertTriangle } from "lucide-react";
import { statusColorProps } from "@/lib/agenda-config";
import {
  timerLevel,
  timerColorClass,
  formatDuration,
  elapsedSince,
  isNewHighlight,
  type YardAppointment,
  type YardSettings,
} from "@/lib/yard-utils";
import { formatDateBR } from "@/lib/agenda-safety";

interface YardCardProps {
  item: YardAppointment;
  settings: YardSettings;
  now: number;
  completionStatus: string;
  onCheckIn: (item: YardAppointment) => void;
  onCheckOut: (item: YardAppointment) => void;
  onDetails: (item: YardAppointment) => void;
  onPlateClick: (plate: string) => void;
  onForward?: ((item:YardAppointment)=>void) | undefined;
}

export function YardCard({ item, settings, now, completionStatus, onCheckIn, onCheckOut, onDetails, onPlateClick, onForward }: YardCardProps) {
  const refTime = item.lastStatusChangeAt ?? item.registeredAt;
  const elapsed = elapsedSince(refTime, now);
  const level = timerLevel(elapsed, settings);
  const highlight = isNewHighlight(item.registeredAt, item.lastStatusChangeAt, settings.new_highlight_minutes, now);
  const sp = statusColorProps(item.status);
  const isCompleted = item.status === completionStatus;
  const hasCheckIn = !!item.checkInAt;
  const hasCheckOut = !!item.checkOutAt;

  const deadlineOverdue = item.currentDeadline && !isCompleted && new Date(item.currentDeadline + "T23:59:59").getTime() < now;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-accent",
        highlight && "animate-pulse border-2 border-accent",
      )}
    >
      <div className="p-3 space-y-2">
        {/* Placa + status */}
        <div className="flex items-start justify-between gap-2">
          <Button
            variant="link"
            className="h-auto min-h-0 p-0 text-lg font-bold text-primary"
            onClick={() => onPlateClick(item.plate)}
          >
            {item.plate || "Sem placa"}
            <ChevronRight className="ml-0.5 size-4" />
          </Button>
          <span
            className={cn("shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold", sp.className)}
            style={sp.style}
          >
            {item.status || "Sem situação"}
          </span>
        </div>

        {/* Modelo + marca */}
        <p className="text-sm font-medium">{[item.brand, item.model].filter(Boolean).join(" · ") || "—"}</p>

        {/* Timer */}
        <div className="flex items-center gap-1.5">
          <Clock className={cn("size-3.5", timerColorClass(level))} />
          <span className={cn("text-sm font-semibold", timerColorClass(level))}>
            {formatDuration(elapsed)}
          </span>
          <span className="text-[11px] text-muted-foreground">no status atual</span>
        </div>

        <p className="text-xs text-muted-foreground">{item.forwardedAt ? `${formatDuration(elapsedSince(item.forwardedAt,now))} neste local` : "Sem registro de entrada no local"}</p>
        {/* Prazo */}
        {item.currentDeadline && (
          <div className="flex items-center gap-1.5">
            {deadlineOverdue && <AlertTriangle className="size-3.5 text-destructive" />}
            <span className={cn("text-xs", deadlineOverdue ? "font-semibold text-destructive" : "text-muted-foreground")}>
              Prazo: {formatDateBR(item.currentDeadline)}
              {deadlineOverdue && " (atrasado)"}
            </span>
          </div>
        )}

        {/* Loja + contato */}
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {item.store && <p>Loja: {item.store}</p>}
          {item.contact && <p>Contato: {item.contact}</p>}
          {item.contactNumber && <p>Tel: {item.contactNumber}</p>}
        </div>

        {/* Problema */}
        {item.issue && (
          <div className="rounded bg-muted/50 px-2 py-1.5">
            <p className="text-[11px] leading-4 text-muted-foreground">{item.issue}</p>
          </div>
        )}

        {/* Observação */}
        {item.note && (
          <p className="text-[11px] italic text-muted-foreground">Obs: {item.note}</p>
        )}

        {/* Operador */}
        {item.operator && (
          <p className="text-xs">Mecânico: <span className="font-medium">{item.operator}</span></p>
        )}

        {/* Urgente */}
        {item.priorityUrgent && !isCompleted && (
          <span className="inline-flex items-center rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
            URGENTE
          </span>
        )}
      </div>

      {/* Ações */}
      <div className="border-t px-3 py-2 flex flex-wrap gap-1.5">
        {onForward && <Button size="sm" variant="outline" onClick={()=>onForward(item)}>Encaminhar</Button>}
        {!hasCheckIn && (
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onCheckIn(item)}>
            <LogIn className="size-3" /> Entrada
          </Button>
        )}
        {hasCheckIn && !hasCheckOut && !isCompleted && (
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onCheckOut(item)}>
            <LogOut className="size-3" /> Saída
          </Button>
        )}
        {hasCheckIn && (
          <span className="inline-flex items-center self-center text-[10px] text-green-600 dark:text-green-400">
            ✓ Entrada {new Date(item.checkInAt ?? "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <Button size="sm" variant="ghost" className="ml-auto gap-1 text-xs text-primary" onClick={() => onDetails(item)}>
          Detalhes <ChevronRight className="size-3" />
        </Button>
      </div>
    </article>
  );
}