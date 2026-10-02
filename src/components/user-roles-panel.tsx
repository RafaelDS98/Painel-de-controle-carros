import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
    <h3 className="font-semibold">Usuários e permissões</h3>
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : users.map((row) => {
      const self = row.user_id === currentUserId;
      return <div key={row.user_id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm">
        <div className="min-w-0 flex-1"><p className="font-medium">{row.full_name || "Sem nome"}{self && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}</p><p className="truncate text-xs text-muted-foreground">{row.email}</p></div>
        <select aria-label={`Perfil de ${row.full_name || row.email}`} className={selectClass} value={row.role ?? ""} disabled={self || savingId === row.user_id} onChange={(e) => change(row, e.target.value)}>
          <option value="">Sem acesso</option>
          {(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}
        </select>
      </div>;
    })}
  </section>;
}
