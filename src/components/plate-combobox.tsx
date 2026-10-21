import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  pickRegisteredPlate,
  plateOptionSummary,
  plateSearchTerm,
  type PlateOption,
} from "@/lib/plate-pick";

/** Campo de placa estilo SGLOC: só aceita veículos cadastrados, escolhidos na lista. */
export function PlateCombobox({
  value,
  onChange,
  autoFocus,
}: {
  value: string | null;
  onChange: (plate: string | null) => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value ?? "");
  const [term, setTerm] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTerm(plateSearchTerm(text)), 250);
    return () => clearTimeout(t);
  }, [text]);
  const options = useQuery({
    queryKey: ["plate-options", term],
    enabled: !!term,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("plate,status,prefixo,ano,modelo")
        .ilike("plate", `%${term}%`)
        .order("plate")
        .limit(20);
      if (error) throw error;
      return data as PlateOption[];
    },
  });
  const list = term ? (options.data ?? []) : [];
  const choose = (o: PlateOption) => {
    setText(o.plate);
    setOpen(false);
    onChange(o.plate);
  };
  return (
    <div className="relative">
      <Input
        autoFocus={autoFocus}
        placeholder="Placa (digite e escolha na lista)"
        value={text}
        aria-label="Placa"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            const match = pickRegisteredPlate(text, list);
            if (match && !value) choose(match);
          }, 150)
        }
      />
      {open && term && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {options.isLoading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Buscando…</li>
          ) : list.length ? (
            list.map((o) => (
              <li key={o.plate}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o)}
                >
                  <span className="font-semibold">{o.plate}</span>
                  {o.status && <Badge variant="outline">{o.status}</Badge>}
                  <span className="text-xs text-muted-foreground">{plateOptionSummary(o)}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-sm text-destructive">
              Placa não cadastrada — peça ao Master/Gerente para cadastrar.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
