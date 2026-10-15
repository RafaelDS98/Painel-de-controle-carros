// Badge colorido para status de O.S.
import { cn } from "@/lib/utils";
import { statusLabel, statusColor, statusBgColor } from "@/lib/os/os-status";

interface OsStatusBadgeProps {
  statusId: number;
  label?: string;
  color?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "px-1.5 py-0.5 text-xs",
  md: "px-2 py-0.5 text-xs",
  lg: "px-2.5 py-1 text-sm",
};

export function OsStatusBadge({ statusId, label, color, className, size = "md" }: OsStatusBadgeProps) {
  const displayLabel = label ?? statusLabel(statusId);
  const displayColor = color ?? statusColor(statusId);
  const bgColor = statusBgColor(displayColor);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium whitespace-nowrap",
        sizeClasses[size],
        className,
      )}
      style={{ backgroundColor: bgColor, color: displayColor }}
    >
      <span
        className="mr-1 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: displayColor }}
      />
      {displayLabel}
    </span>
  );
}