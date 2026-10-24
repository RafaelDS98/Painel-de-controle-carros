import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OS_STATUS, osDate } from "@/lib/os";

/** Agenda: O.S. com serviço concluído aguardando o cliente retirar o veículo. */
export function AwaitingPickup() {
  const [open, setOpen] = useState(true);
  const q = useQuery({
    queryKey: ["os-awaiting-pickup"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select(
          "id, numero, plate, modelo, condutor_nome, condutor_contato, updated_at, workshops(name)",
        )
        .eq("status_id", OS_STATUS.AGUARDANDO_RETIRADA)
        .is("archived_at", null)
        .order("updated_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  return (
    <section className="rounded-lg border bg-card shadow-sm" aria-label="Aguardando retirada">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 px-4 py-2 text-left font-semibold"
      >
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        <PackageCheck className="size-4 text-primary" />
        Aguardando retirada ({rows.length})
        <span className="text-xs font-normal text-muted-foreground">
          · avise o cliente e finalize a O.S. na retirada
        </span>
      </button>
      {open && (
        <ul className="grid gap-2 border-t p-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to="/ordens-servico/$id"
                params={{ id: r.id }}
                className="block rounded-md border p-3 text-sm hover:bg-muted/40"
              >
                <p className="font-bold">
                  {r.plate}{" "}
                  <span className="font-normal text-muted-foreground">· O.S. {r.numero}</span>
                </p>
                <p className="text-muted-foreground">
                  {[r.modelo, (r.workshops as { name?: string } | null)?.name]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Contato: {[r.condutor_nome, r.condutor_contato].filter(Boolean).join(" ") || "—"}{" "}
                  · pronto desde {osDate(r.updated_at)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
