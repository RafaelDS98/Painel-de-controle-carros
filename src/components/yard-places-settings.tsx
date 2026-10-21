import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useYardGroups } from "@/components/yard-groups-settings";
import { validGroupName } from "@/lib/yard-groups";
import { toggleId } from "@/lib/plate-pick";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** Tabela de locais com seleção múltipla e ações em lote (só Master grava). */
export function YardPlacesSettings({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const groups = useYardGroups();
  const places = useQuery({
    queryKey: ["yard-places"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("id,name,active,is_own_yard")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "own" | "ext">("all");
  const [sel, setSel] = useState<string[]>([]);
  const [groupId, setGroupId] = useState("");
  const [newPlace, setNewPlace] = useState("");
  const [busy, setBusy] = useState(false);

  const groupNames = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const g of groups.data ?? [])
      for (const id of g.workshopIds) m.set(id, [...(m.get(id) ?? []), g.name]);
    return m;
  }, [groups.data]);

  const filtered = (places.data ?? []).filter(
    (p) =>
      fold(p.name).includes(fold(search)) &&
      (typeFilter === "all" || (typeFilter === "own" ? p.is_own_yard : !p.is_own_yard)),
  );
  const allSelected = filtered.length > 0 && filtered.every((p) => sel.includes(p.id));

  async function run(label: string, fn: () => PromiseLike<{ error: { message: string } | null }>) {
    if (!sel.length) {
      toast.error("Marque ao menos um local.");
      return;
    }
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${label}: ${sel.length} local(is).`);
    setSel([]);
    await qc.invalidateQueries({ queryKey: ["yard-places"] });
    await qc.invalidateQueries({ queryKey: ["yard-groups"] });
    onChanged();
  }

  async function addPlace() {
    if (!validGroupName(newPlace)) {
      toast.error("Informe o nome do local.");
      return;
    }
    const { error } = await supabase.rpc("catalog_add", {
      _kind: "workshop",
      _name: newPlace.trim(),
      _source: "manual",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Local cadastrado.");
    setNewPlace("");
    await qc.invalidateQueries({ queryKey: ["yard-places"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          className="w-56"
          placeholder="Pesquisar local"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="own">Pátio próprio</SelectItem>
            <SelectItem value="ext">Oficina externa</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="w-56"
          placeholder="Nome do novo local"
          value={newPlace}
          onChange={(e) => setNewPlace(e.target.value)}
        />
        <Button variant="outline" size="sm" className="h-10" onClick={() => void addPlace()}>
          Novo local
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-sm">
        <span className="font-medium">{sel.length} selecionado(s)</span>
        <Button
          size="sm"
          disabled={busy}
          onClick={() =>
            void run("Marcados como pátio próprio", () =>
              supabase.rpc("set_own_yards", { _ids: sel, _value: true }),
            )
          }
        >
          Marcar como pátio próprio
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run("Marcados como oficina externa", () =>
              supabase.rpc("set_own_yards", { _ids: sel, _value: false }),
            )
          }
        >
          Marcar como oficina externa
        </Button>
        <Select value={groupId} onValueChange={setGroupId}>
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Escolher grupo…" />
          </SelectTrigger>
          <SelectContent>
            {(groups.data ?? []).map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !groupId}
          onClick={() =>
            void run("Adicionados ao grupo", () =>
              supabase.rpc("set_group_members_bulk", { _group_id: groupId, _ids: sel, _add: true }),
            )
          }
        >
          Adicionar ao grupo
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !groupId}
          onClick={() =>
            void run("Removidos do grupo", () =>
              supabase.rpc("set_group_members_bulk", { _group_id: groupId, _ids: sel, _add: false }),
            )
          }
        >
          Remover do grupo
        </Button>
      </div>

      {places.isError && <p className="text-sm text-destructive">Locais indisponíveis.</p>}
      <div className="max-h-[50vh] overflow-y-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="w-10 px-3 py-2">
                <Checkbox
                  aria-label="Marcar todos os filtrados"
                  checked={allSelected}
                  onCheckedChange={(v) =>
                    setSel(
                      v
                        ? [...new Set([...sel, ...filtered.map((p) => p.id)])]
                        : sel.filter((id) => !filtered.some((p) => p.id === id)),
                    )
                  }
                />
              </th>
              <th className="px-3 py-2">Local</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Grupos</th>
              <th className="px-3 py-2">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-3 py-1.5">
                  <Checkbox
                    aria-label={`Selecionar ${p.name}`}
                    checked={sel.includes(p.id)}
                    onCheckedChange={(v) => setSel((s) => toggleId(s, p.id, !!v))}
                  />
                </td>
                <td className="px-3 py-1.5">{p.name}</td>
                <td className="px-3 py-1.5">
                  {p.is_own_yard ? (
                    <Badge>Pátio próprio</Badge>
                  ) : (
                    <span className="text-muted-foreground">Oficina externa</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">
                  {(groupNames.get(p.id) ?? []).join(", ") || "—"}
                </td>
                <td className="px-3 py-1.5 text-xs">{p.active ? "Sim" : "Não"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
