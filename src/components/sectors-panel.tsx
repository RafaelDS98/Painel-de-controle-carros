import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { MODULES, knownModules, type ModuleKey } from "@/lib/modules";

type Sector = { id: string; name: string; modules: string[] };
type UserRow = { user_id: string; full_name: string | null; email: string | null; role: string | null };

/** Setores: definem quais módulos cada usuário enxerga (só master). Sem setor, vale o padrão do perfil. */
export function SectorsPanel() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [links, setLinks] = useState<{ user_id: string; sector_id: string }[]>([]);
  const [name, setName] = useState("");
  const [newModules, setNewModules] = useState<ModuleKey[]>(["agenda", "historicos"]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [s, u, l] = await Promise.all([
      supabase.from("sectors").select("id, name, modules").order("name"),
      supabase.rpc("list_users_with_roles"),
      supabase.from("user_sectors").select("user_id, sector_id"),
    ]);
    const failure = s.error ?? u.error ?? l.error;
    if (failure) { setError(failure.message); return; }
    setSectors(s.data ?? []); setUsers((u.data ?? []) as UserRow[]); setLinks(l.data ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function run(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setError("");
    try {
      const result = await action();
      if (result.error) { setError(result.error.message.includes("sectors_name_unique") ? "Já existe um setor com esse nome." : result.error.message); return false; }
      await load(); return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar."); return false; }
    finally { setBusy(false); }
  }
  async function create(event: React.FormEvent) {
    event.preventDefault();
    const value = name.trim().replace(/\s+/g, " ");
    if (!value) { setError("Informe o nome do setor."); return; }
    if (await run(() => supabase.from("sectors").insert({ name: value, modules: newModules }))) setName("");
  }
  const toggleModule = (sector: Sector, key: ModuleKey) => {
    const current = knownModules(sector.modules);
    const next = current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key];
    void run(() => supabase.from("sectors").update({ modules: next }).eq("id", sector.id));
  };
  const toggleUser = (sector: Sector, userId: string, on: boolean) =>
    void run(() => on ? supabase.from("user_sectors").delete().eq("user_id", userId).eq("sector_id", sector.id) : supabase.from("user_sectors").insert({ user_id: userId, sector_id: sector.id }));
  const assigned = new Set(links.map((link) => link.user_id));
  const withoutSector = users.filter((user) => user.role && user.role !== "master" && !assigned.has(user.user_id));

  return <section className="space-y-4">
    <div><h3 className="font-semibold">Setores e módulos</h3><p className="text-xs text-muted-foreground">O setor define quais áreas o usuário vê. Quem está em mais de um setor vê a soma dos módulos. Usuários sem setor usam o padrão do perfil (Agenda e Históricos; perfil Oficina só vê Oficina). Master vê tudo.</p></div>
    <form onSubmit={create} className="space-y-2 rounded-md border bg-muted/30 p-3">
      <label className="block text-sm">Novo setor<Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
      <div className="flex flex-wrap gap-4">{MODULES.map((module) => <label key={module.key} className="flex items-center gap-2 text-sm"><Checkbox checked={newModules.includes(module.key)} onCheckedChange={() => setNewModules((current) => current.includes(module.key) ? current.filter((entry) => entry !== module.key) : [...current, module.key])} />{module.label}</label>)}</div>
      <Button type="submit" size="sm" disabled={busy}>Criar setor</Button>
    </form>
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    {sectors.map((sector) => <div key={sector.id} className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold">{sector.name}</h4>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (window.confirm(`Remover o setor “${sector.name}”? Os usuários dele voltam ao padrão do perfil, a menos que estejam em outro setor.`)) void run(() => supabase.from("sectors").delete().eq("id", sector.id)); }}>Remover setor</Button></div>
      <div className="flex flex-wrap gap-4" role="group" aria-label={`Módulos de ${sector.name}`}>{MODULES.map((module) => <label key={module.key} title={module.description} className="flex items-center gap-2 text-sm"><Checkbox checked={knownModules(sector.modules).includes(module.key)} disabled={busy} onCheckedChange={() => toggleModule(sector, module.key)} />{module.label}</label>)}</div>
      <div className="grid gap-1 sm:grid-cols-2" role="group" aria-label={`Usuários de ${sector.name}`}>{users.filter((user) => user.role && user.role !== "master").map((user) => {
        const on = links.some((link) => link.user_id === user.user_id && link.sector_id === sector.id);
        return <label key={user.user_id} className="flex min-h-9 items-center gap-2 text-sm"><Checkbox checked={on} disabled={busy} onCheckedChange={() => toggleUser(sector, user.user_id, on)} /><span className="truncate">{user.full_name || user.email || "Sem nome"}</span></label>;
      })}</div>
    </div>)}
    {sectors.length === 0 && <p className="text-sm text-muted-foreground">Nenhum setor criado. Todos usam o padrão do perfil.</p>}
    {withoutSector.length > 0 && <p className="text-xs text-muted-foreground">Sem setor (padrão do perfil): {withoutSector.map((user) => user.full_name || user.email || "Sem nome").join(", ")}.</p>}
  </section>;
}
