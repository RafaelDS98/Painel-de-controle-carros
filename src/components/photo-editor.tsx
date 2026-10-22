import { useEffect, useRef, useState } from "react";
import { Pencil, Undo2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DAMAGE_LEGEND } from "@/lib/vistoria";

type Op =
  | { t: "line"; color: string; width: number; pts: [number, number][] }
  | { t: "mark"; code: string; color: string; x: number; y: number };

/** Visualiza a foto e permite marcar avarias: traço fino com cor livre e selos da legenda. */
export function PhotoEditor({
  src,
  caption,
  onSave,
  onClose,
}: {
  src: string;
  caption?: string;
  onSave?: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<HTMLImageElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [ops, setOps] = useState<Op[]>([]);
  const [tool, setTool] = useState<string>("pen"); // "pen" ou código da legenda
  const [color, setColor] = useState("#ff2d2d");
  const [width, setWidth] = useState(3);
  const drawing = useRef<Op | null>(null);

  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      img.current = i;
      redraw([]);
    };
    i.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function redraw(list: Op[]) {
    const c = canvas.current;
    const i = img.current;
    if (!c || !i) return;
    c.width = i.width;
    c.height = i.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(i, 0, 0);
    const scale = i.width / 800;
    for (const op of list) {
      if (op.t === "line") {
        ctx.strokeStyle = op.color;
        ctx.lineWidth = op.width * scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        op.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      } else {
        const r = 16 * scale;
        ctx.fillStyle = op.color;
        ctx.beginPath();
        ctx.arc(op.x, op.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2 * scale;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${18 * scale}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(op.code, op.x, op.y + 1);
      }
    }
  }
  useEffect(() => redraw(ops), [ops]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect();
    const c = e.currentTarget;
    return [
      ((e.clientX - r.left) / r.width) * c.width,
      ((e.clientY - r.top) / r.height) * c.height,
    ];
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-2 sm:p-4">
      <div className="flex flex-wrap items-center gap-2 pb-2">
        <span className="text-sm font-medium text-white">{caption}</span>
        <div className="ml-auto flex gap-2">
          {onSave && !editing && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          )}
          {editing && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setOps((o) => o.slice(0, -1))}
                disabled={!ops.length}
              >
                <Undo2 className="h-4 w-4" /> Desfazer
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onSave?.(canvas.current!.toDataURL("image/jpeg", 0.85));
                  onClose();
                }}
              >
                <Check className="h-4 w-4" /> Salvar
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-md bg-card p-2 text-xs">
          <button
            onClick={() => setTool("pen")}
            className={cn(
              "flex h-9 items-center gap-1 rounded-md border px-2",
              tool === "pen" && "border-primary bg-primary text-primary-foreground",
            )}
          >
            <Pencil className="h-3.5 w-3.5" /> Traço
          </button>
          <input
            type="color"
            aria-label="Cor do traço"
            value={color}
            onChange={(e) => (setColor(e.target.value), setTool("pen"))}
            className="h-9 w-10 cursor-pointer rounded border bg-transparent"
          />
          <select
            aria-label="Espessura"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="h-9 rounded-md border bg-background px-1"
          >
            <option value={2}>Fino</option>
            <option value={3}>Médio</option>
            <option value={5}>Grosso</option>
          </select>
          <span className="ml-2 text-muted-foreground">Legenda:</span>
          {DAMAGE_LEGEND.map((l) => (
            <button
              key={l.code}
              onClick={() => setTool(l.code)}
              className={cn(
                "flex h-9 items-center gap-1 rounded-md border px-2",
                tool === l.code && "ring-2 ring-primary",
              )}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: l.color }}
              >
                {l.code}
              </span>
              {l.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-center justify-center pt-2">
        <canvas
          ref={canvas}
          className={cn(
            "max-h-full max-w-full object-contain",
            editing && "touch-none cursor-crosshair",
          )}
          onPointerDown={(e) => {
            if (!editing) return;
            const [x, y] = pos(e);
            if (tool === "pen") {
              drawing.current = { t: "line", color, width, pts: [[x, y]] };
              e.currentTarget.setPointerCapture(e.pointerId);
            } else {
              const l = DAMAGE_LEGEND.find((d) => d.code === tool)!;
              setOps((o) => [...o, { t: "mark", code: l.code, color: l.color, x, y }]);
            }
          }}
          onPointerMove={(e) => {
            const op = drawing.current;
            if (!op || op.t !== "line") return;
            op.pts.push(pos(e));
            redraw([...ops, op]);
          }}
          onPointerUp={() => {
            const op = drawing.current;
            drawing.current = null;
            if (op && op.t === "line" && op.pts.length > 1) setOps((o) => [...o, op]);
          }}
        />
      </div>
    </div>
  );
}
