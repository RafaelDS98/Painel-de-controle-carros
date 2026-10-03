import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createPanelUser } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus } from "lucide-react";

type Role = "atendimento" | "gerente" | "master";
type UserRow = { user_id: string; full_name: string | null; email: string | null; role: Role | null };
const roleNames: Record<Role, string> = { atendimento: "Atendimento", gerente: "Gerente", master: "Master" };
const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:opacity-60";

export function UserRolesPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({ fullName: "", email: "", role: "atendimento" as Role, password: "" });
  const [creating, setCreating] = useState(false);
  const createUser = useServerFn(createPanelUser);

  async function submitNew(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setNotice("");
    const email = draft.email.trim();
    if (draft.fullName.trim().length < 2) { setError("Informe o nome (mínimo 2 letras)."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("E-mail inválido."); return; }
    if (draft.password.length < 8) { setError("A senha provisória precisa ter pelo menos 8 caracteres."); return; }
    setCreating(true);
    try {
      await createUser({ data: { ...draft, email } });
      setNotice(`Usuário ${draft.fullName.trim()} criado como ${roleNames[draft.role]}. Ele deverá trocar a senha no primeiro acesso.`);
      setDraft({ fullName: "", email: "", role: "atendimento", password: "" });
      setFormOpen(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar o usuário.");
    } finally { setCreating(false); }
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_users_with_roles");
    if (error) setError(error.message); else setUsers((data ?? []) as UserRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function change(row: UserRow, value: string) {
    setSavingId(row.user_id); setError(""); setNotice("");
    const role = (value || null) as Role | null;
    const { error } = await supabase.rpc("set_user_role", { _user_id: row.user_id, _role: role as Role });
    if (error) setError(error.message);
    else { setUsers((list) => list.map((u) => u.user_id === row.user_id ? { ...u, role } : u)); setNotice(`Perfil de ${row.full_name || row.email} atualizado.`); }
    setSavingId(null);
  }

  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Usuários e permissões</h3><Button size="sm" variant="outline" onClick={() => { setFormOpen((v) => !v); setError(""); }}><UserPlus /> Novo usuário</Button></div>
    {formOpen && <form onSubmit={submitNew} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2" aria-label="Novo usuário">
      <label className="text-sm">Nome<Input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} maxLength={120} /></label>
      <label className="text-sm">E-mail<Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} maxLength={255} /></label>
      <label className="text-sm">Perfil<select className={selectClass + " block h-10 w-full"} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>{(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}</select></label>
      <label className="text-sm">Senha provisória<Input type="password" autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} /><span className="text-xs text-muted-foreground">Mínimo 8 caracteres. Não fica salva no painel; o usuário troca no primeiro acesso.</span></label>
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={creating}>{creating ? "Criando…" : "Criar usuário"}</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button></div>
    </form>}
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : users.map((row) => {
      const self = row.user_id === currentUserId;
      return <div key={row.user_id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm">
        <div className="min-w-0 flex-1"><p className="font-medium">{row.full_name || "Sem nome"}{self && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}</p><p className="truncate text-xs text-muted-foreground">{row.email || "—"}</p></div>
        <select aria-label={`Perfil de ${row.full_name || row.email}`} className={selectClass} value={row.role ?? ""} disabled={self || savingId === row.user_id} onChange={(e) => change(row, e.target.value)}>
          <option value="">Sem acesso</option>
          {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
        </select>
      </div>;
    })}
  </section>;
}
