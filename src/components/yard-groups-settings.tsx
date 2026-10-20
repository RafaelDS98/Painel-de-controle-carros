import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { validGroupName } from "@/lib/yard-groups";

export function useYardGroups() {
  return useQuery({
    queryKey: ["yard-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("yard_groups")
        .select("id,name,active,yard_group_members(workshop_id,workshops(name))")
        .order("name");
      if (error) throw error;
      return data.map((g) => ({
        id: g.id,
        name: g.name,
        active: g.active,
        workshopIds: g.yard_group_members.map((m) => m.workshop_id),
        workshopNames: g.yard_group_members.map((m) => m.workshops?.name ?? ""),
      }));
    },
  });
}

/** Master cria locais (pátios/oficinas) e grupos de locais. */
export function YardGroupsSettings() {
  const qc = useQueryClient();
  const groups = useYardGroups();
  const ws = useQuery({
    queryKey: ["groups-workshops"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workshops")
        .select("id,name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
  const [newPlace, setNewPlace] = useState("");
  const [editing, setEditing] = useState<{ id?: string; name: string; ids: string[] } | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  async function addPlace() {
    if (!validGroupName(newPlace)) return toast.error("Informe o nome do local.");
    const { error } = await supabase.rpc("catalog_add", {
      _kind: "workshop",
      _name: newPlace.trim(),
      _source: "manual",
    });
    if (error) return toast.error(error.message);
    toast.success("Local cadastrado.");
    setNewPlace("");
    await qc.invalidateQueries({ queryKey: ["groups-workshops"] });
  }

  async function saveGroup() {
    if (!editing || !validGroupName(editing.name)) return toast.error("Informe o nome do grupo.");
    setBusy(true);
    try {
      let id = editing.id;
      if (id) {
        const { error } = await supabase
          .from("yard_groups")
          .update({ name: editing.name.trim() })
          .eq("id", id);
        if (error) throw error;
        const { error: d } = await supabase.from("yard_group_members").delete().eq("group_id", id);
        if (d) throw d;
      } else {
        const { data, error } = await supabase
          .from("yard_groups")
          .insert({ name: editing.name.trim() })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }
      if (editing.ids.length) {
        const { error } = await supabase
          .from("yard_group_members")
          .insert(editing.ids.map((w) => ({ group_id: id!, workshop_id: w })));
        if (error) throw error;
      }
      toast.success("Grupo salvo.");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: ["yard-groups"] });
    } catch (e) {
      toast.error(
        e && typeof e === "object" && "message" in e ? String(e.message) : "Falha ao salvar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const { error } = await supabase.from("yard_groups").update({ active: !active }).eq("id", id);
    if (error) toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["yard-groups"] });
  }

  const filtered = (ws.data ?? []).filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <section className="space-y-3">
      <h3 className="border-b pb-1 text-sm font-semibold">Locais e grupos</h3>
      <div className="flex flex-wrap gap-2">
        <Input
          className="w-64"
          placeholder="Novo pátio ou oficina"
          value={newPlace}
          onChange={(e) => setNewPlace(e.target.value)}
        />
        <Button variant="outline" size="sm" onClick={() => void addPlace()}>
          Novo pátio
        </Button>
        <Button size="sm" onClick={() => setEditing({ name: "", ids: [] })}>
          Novo grupo
        </Button>
      </div>
      {groups.isError && <p className="text-sm text-destructive">Grupos indisponíveis.</p>}
      <ul className="space-y-1 text-sm">
        {groups.data?.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center gap-2">
            <span className={g.active ? "" : "text-muted-foreground line-through"}>
              {g.name} · {g.workshopIds.length} local(is)
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => setEditing({ id: g.id, name: g.name, ids: g.workshopIds })}
            >
              Editar
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => void toggleActive(g.id, g.active)}
            >
              {g.active ? "Desativar" : "Ativar"}
            </Button>
          </li>
        ))}
      </ul>
      {editing && (
        <div className="space-y-2 rounded-md border p-3">
          <Input
            placeholder="Nome do grupo (ex.: Pátios Arrais)"
            value={editing.name}
            onChange={(e) => setEditing({ ...editing, name: e.target.value })}
          />
          <Input
            placeholder="Pesquisar local"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 text-xs">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setEditing({
                  ...editing,
                  ids: [...new Set([...editing.ids, ...filtered.map((w) => w.id)])],
                })
              }
            >
              Marcar visíveis
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing({ ...editing, ids: [] })}>
              Desmarcar todos
            </Button>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {filtered.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={editing.ids.includes(w.id)}
                  onCheckedChange={(v) =>
                    setEditing({
                      ...editing,
                      ids: v ? [...editing.ids, w.id] : editing.ids.filter((x) => x !== w.id),
                    })
                  }
                />
                {w.name}
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void saveGroup()}>
              Salvar grupo
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
