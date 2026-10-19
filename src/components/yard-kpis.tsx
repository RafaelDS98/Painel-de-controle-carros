import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CarFront, Wrench } from "lucide-react";
import { statusColorProps, type StatusOption } from "@/lib/agenda-config";
import type { YardAppointment } from "@/lib/yard-utils";

interface YardKpisProps {
  patioItems: YardAppointment[];
  yardStatuses: StatusOption[];
  activeStatusFilter: string | null;
  onStatusFilter: (status: string | null) => void;
}

export function YardKpis({ patioItems, yardStatuses, activeStatusFilter, onStatusFilter }: YardKpisProps) {
  const total = patioItems.length;

  const statusCounts = yardStatuses.map((s) => ({
    label: s.label,
    count: patioItems.filter((item) => item.status === s.label).length,
    colorToken: s.color_token,
  })).filter((s) => s.count > 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {/* Total */}
      <button
        type="button"
        onClick={() => onStatusFilter(activeStatusFilter === null ? null : null)}
        className={cn(
          "rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-accent",
          activeStatusFilter === null && "border-accent ring-1 ring-accent",
        )}
      >
        <div className="flex items-center gap-2">
          <CarFront className="size-4 text-accent-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Total no pátio</span>
        </div>
        <p className="mt-1 text-2xl font-bold">{total}</p>
      </button>

      {/* Por status */}
      {statusCounts.map((s) => {
        const sp = statusColorProps(s.colorToken);
        const isActive = activeStatusFilter === s.label;
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => onStatusFilter(isActive ? null : s.label)}
            className={cn(
              "rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-accent",
              isActive && "border-accent ring-1 ring-accent",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("size-2.5 rounded-full", sp.className)} style={sp.style} />
              <span className="truncate text-xs font-medium text-muted-foreground">{s.label}</span>
            </div>
            <p className="mt-1 text-2xl font-bold">{s.count}</p>
          </button>
        );
      })}
    </div>
  );
}