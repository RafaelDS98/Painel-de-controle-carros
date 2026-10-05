import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { createPanelUser, resetPanelPassword, updatePanelUser } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, UserPlus } from "lucide-react";
import { PasswordInput, isWeakPassword } from "@/components/my-account";
import { parsePanelError, type AuthField } from "@/lib/auth-errors";

type Role = "atendimento" | "gerente" | "master";
type UserRow = { user_id: string; full_name: string | null; email: string | null; role: Role | null };
type LogRow = { id: string; changed_at: string; actor_id: string | null; target_label: string; action: string; detail: string };
const roleNames: Record<Role, string> = { atendimento: "Atendimento", gerente: "Gerente", master: "Master" };
const selectClass = "h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground disabled:opacity-60";

export function UserRolesPanel({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErr, setFieldErr] = useState<{ field: AuthField; message: string }>({ field: "", message: "" });
  const showErr = (caught: unknown, fallback: string) => { const p = parsePanelError(caught, fallback); setError(p.message); setFieldErr(p); };
  const fe = (f: AuthField) => fieldErr.field === f && fieldErr.message ? <span role="alert" className="mt-1 block text-xs text-destructive">{fieldErr.message}</span> : null;
  const local = (f: AuthField, m: string) => { setError(m); setFieldErr({ field: f, message: m }); };
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({ fullName: "", email: "", role: "atendimento" as Role, password: "" });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ fullName: "", email: "", role: "" as Role | "" });
  const [pw, setPw] = useState({ password: "", confirm: "", requireChange: false });
  const [busy, setBusy] = useState(false);
  const [limits, setLimits] = useState({ atendimento: "1", gerente: "1" });
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [overrideDraft, setOverrideDraft] = useState("");
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const createUser = useServerFn(createPanelUser);
  const updateUser = useServerFn(updatePanelUser);
  const resetPassword = useServerFn(resetPanelPassword);

  async function load() {
    setLoading(true);
    const [{ data, error }, logResult] = await Promise.all([
      supabase.rpc("list_users_with_roles"),
      supabase.from("user_admin_log").select("id, changed_at, actor_id, target_label, action, detail").order("changed_at", { ascending: false }).limit(50),
    ]);
    if (error) setError(error.message); else setUsers((data ?? []) as UserRow[]);
    const [defs, ovs] = await Promise.all([
      supabase.from("edit_limit_defaults").select("role, max_edits"),
      supabase.from("edit_limit_overrides").select("user_id, max_edits"),
    ]);
    const d = { atendimento: "1", gerente: "1" };
    for (const r of defs.data ?? []) if (r.role === "atendimento" || r.role === "gerente") d[r.role] = String(r.max_edits);
    setLimits(d);
    setOverrides(Object.fromEntries((ovs.data ?? []).map((r) => [r.user_id, r.max_edits])));
    setLog((logResult.data ?? []) as LogRow[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function close(id: string) {
    setEditingId(null);
    window.setTimeout(() => rowRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
  }
  function openEdit(row: UserRow) {
    setError(""); setNotice(""); setFieldErr({ field: "", message: "" });
    if (editingId === row.user_id) { close(row.user_id); return; }
    setEditingId(row.user_id);
    setEdit({ fullName: row.full_name ?? "", email: row.email ?? "", role: row.role ?? "" });
    setPw({ password: "", confirm: "", requireChange: false });
    setOverrideDraft(overrides[row.user_id] ? String(overrides[row.user_id]) : "");
  }

  const validLimit = (v: string) => /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 20;
  async function saveDefaults(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setNotice(""); setFieldErr({ field: "", message: "" });
    if (!validLimit(limits.atendimento) || !validLimit(limits.gerente)) { setError("Use um número de 1 a 20 em cada perfil."); return; }
    setBusy(true);
    try {
      for (const role of ["atendimento", "gerente"] as const) {
        const { error } = await supabase.rpc("set_edit_limit_default", { _role: role, _max: Number(limits[role]) });
        if (error) throw error;
      }
      setNotice("Limites de edição salvos."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : (caught as { message?: string })?.message || "Não foi possível salvar os limites."); } finally { setBusy(false); }
  }
  async function saveOverride(row: UserRow, remove: boolean) {
    setError(""); setNotice(""); setFieldErr({ field: "", message: "" });
    if (!remove && !validLimit(overrideDraft)) { setError("Limite individual: use um número de 1 a 20 (ou remova)."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_edit_limit_override", { _user_id: row.user_id, _max: remove ? (null as unknown as number) : Number(overrideDraft) });
      if (error) throw error;
      if (remove) setOverrideDraft("");
      setNotice(remove ? "Limite individual removido; vale o padrão do perfil." : "Limite individual salvo."); await load();
    } catch (caught) { setError((caught as { message?: string })?.message || "Não foi possível salvar o limite."); } finally { setBusy(false); }
  }

  async function submitNew(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setNotice(""); setFieldErr({ field: "", message: "" });
    const email = draft.email.trim();
    if (draft.fullName.trim().length < 2) { local("fullName", "Informe o nome (mínimo 2 letras)."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { local("email", "E-mail inválido ou domínio não aceito."); return; }
    if (draft.password.length < 8) { local("password", "Senha precisa de no mínimo 8 caracteres."); return; }
    setCreating(true);
    try {
      await createUser({ data: { ...draft, email } });
      setNotice(`Usuário ${draft.fullName.trim()} criado como ${roleNames[draft.role]}. Ele deverá trocar a senha no primeiro acesso.`);
      setDraft({ fullName: "", email: "", role: "atendimento", password: "" });
      setFormOpen(false);
      await load();
    } catch (caught) { showErr(caught, "Não foi possível criar o usuário."); } finally { setCreating(false); }
  }

  async function saveEdit(event: React.FormEvent, row: UserRow) {
    event.preventDefault();
    setError(""); setNotice(""); setFieldErr({ field: "", message: "" });
    const email = edit.email.trim().toLowerCase();
    if (edit.fullName.trim().length < 2) { local("fullName", "Informe o nome (mínimo 2 letras)."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { local("email", "E-mail inválido ou domínio não aceito."); return; }
    const role = edit.role || null;
    if (row.user_id === currentUserId && row.role === "master" && role !== "master" &&
      !window.confirm("Você está removendo o seu próprio perfil master e perderá acesso às configurações. Confirmar?")) return;
    setBusy(true);
    try {
      const result = await updateUser({ data: { userId: row.user_id, fullName: edit.fullName.trim(), email, role } });
      setNotice(result.changed ? `Cadastro de ${edit.fullName.trim()} atualizado.` : "Nenhuma alteração para salvar.");
      close(row.user_id); await load();
    } catch (caught) { showErr(caught, "Não foi possível salvar."); } finally { setBusy(false); }
  }

  async function savePassword(row: UserRow) {
    setError(""); setNotice(""); setFieldErr({ field: "", message: "" });
    if (pw.password.length < 6) { local("password", "Senha precisa de no mínimo 6 caracteres."); return; }
    if (pw.password !== pw.confirm) { local("password", "As senhas não conferem."); return; }
    setBusy(true);
    try {
      await resetPassword({ data: { userId: row.user_id, password: pw.password, requireChange: pw.requireChange } });
      setNotice(`Senha de ${row.full_name || row.email || "usuário"} redefinida.${row.user_id !== currentUserId ? " As sessões abertas dele foram encerradas." : ""}`);
      setPw({ password: "", confirm: "", requireChange: false });
      close(row.user_id); await load();
    } catch (caught) { showErr(caught, "Não foi possível redefinir a senha."); } finally { setBusy(false); }
  }

  const nameOf = (id: string | null) => users.find((u) => u.user_id === id)?.full_name || users.find((u) => u.user_id === id)?.email || "—";

  return <section className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Usuários e permissões</h3><Button size="sm" variant="outline" onClick={() => { setFormOpen((v) => !v); setError(""); }}><UserPlus /> Novo usuário</Button></div>
    <form noValidate onSubmit={saveDefaults} className="space-y-2 rounded-md border p-3" aria-label="Limite de edições por agendamento">
      <h4 className="font-semibold">Limite de edições por agendamento</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Atendimento<Input type="number" min={1} max={20} value={limits.atendimento} onChange={(e) => setLimits({ ...limits, atendimento: e.target.value })} /></label>
        <label className="text-sm">Gerente<Input type="number" min={1} max={20} value={limits.gerente} onChange={(e) => setLimits({ ...limits, gerente: e.target.value })} /></label>
        <div className="text-sm">Master<p className="flex h-10 items-center text-muted-foreground">Ilimitado</p></div>
      </div>
      <p className="text-xs text-muted-foreground">Vale na hora para todos os agendamentos. O contador é por agendamento.</p>
      <Button type="submit" size="sm" disabled={busy}>Salvar</Button>
    </form>
    {formOpen && <form noValidate onSubmit={submitNew} className="grid gap-3 rounded-md border p-4 sm:grid-cols-2" aria-label="Novo usuário">
      <label className="text-sm">Nome<Input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} maxLength={120} />{fe("fullName")}</label>
      <label className="text-sm">E-mail<Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} maxLength={255} />{fe("email")}</label>
      <label className="text-sm">Perfil<select className={selectClass} value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>{(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}</select>{fe("role")}</label>
      <label className="text-sm">Senha provisória<Input type="password" autoComplete="new-password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />{fe("password")}<span className="text-xs text-muted-foreground">Mínimo 8 caracteres. Não fica salva no painel; o usuário troca no primeiro acesso.</span></label>
      <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={creating}>{creating ? "Criando…" : "Criar usuário"}</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button></div>
    </form>}
    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : !users.length ? <p className="text-sm text-muted-foreground">Nenhum usuário.</p> : users.map((row) => {
      const self = row.user_id === currentUserId;
      const open = editingId === row.user_id;
      return <div key={row.user_id} ref={(el) => { rowRefs.current[row.user_id] = el; }} className="border-b py-2 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><p className="font-medium">{row.full_name || "Sem nome"}{self && <span className="ml-2 text-xs text-muted-foreground">(você)</span>}</p><p className="truncate text-xs text-muted-foreground">{row.email || "—"} · {row.role ? roleNames[row.role] : "Sem acesso"}{overrides[row.user_id] && row.role !== "master" ? ` · limite individual: ${overrides[row.user_id]}` : ""}</p></div>
          <Button size="sm" variant={open ? "secondary" : "outline"} className="min-h-11 sm:min-h-9" aria-expanded={open} onClick={() => openEdit(row)}><Pencil /> Editar</Button>
        </div>
        {open && <div className="mt-3 space-y-4 rounded-md border bg-muted/30 p-3">
          <form noValidate onSubmit={(e) => saveEdit(e, row)} className="grid gap-3 sm:grid-cols-3" aria-label={`Editar ${row.full_name || row.email}`}>
            <label className="text-sm">Nome<Input value={edit.fullName} onChange={(e) => setEdit({ ...edit, fullName: e.target.value })} maxLength={120} />{editingId && fe("fullName")}</label>
            <label className="text-sm">E-mail<Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} maxLength={255} />{fe("email")}</label>
            <label className="text-sm">Perfil<select className={selectClass} value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as Role | "" })}><option value="">Sem acesso</option>{(Object.keys(roleNames) as Role[]).map((r) => <option key={r} value={r}>{roleNames[r]}</option>)}</select>{fe("role")}</label>
            <div className="flex flex-wrap gap-2 sm:col-span-3"><Button type="submit" disabled={busy}>Salvar cadastro</Button><Button type="button" variant="outline" onClick={() => close(row.user_id)}>Cancelar</Button></div>
          </form>
          {(row.role === "atendimento" || row.role === "gerente") && <div className="grid gap-2 border-t pt-3 sm:grid-cols-2" role="group" aria-label="Limite individual de edições">
            <label className="text-sm">Limite individual de edições<Input type="number" min={1} max={20} placeholder={`Padrão do perfil (${limits[row.role]})`} value={overrideDraft} onChange={(e) => setOverrideDraft(e.target.value)} /></label>
            <div className="flex flex-wrap items-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => saveOverride(row, false)}>Salvar limite</Button><Button type="button" variant="ghost" disabled={busy || !overrides[row.user_id]} onClick={() => saveOverride(row, true)}>Remover limite individual</Button></div>
          </div>}
          <div className="grid gap-3 border-t pt-3 sm:grid-cols-2" role="group" aria-label="Redefinir senha">
            <h4 className="font-semibold sm:col-span-2">Redefinir senha</h4>
            <PasswordInput label="Nova senha" value={pw.password} onChange={(v) => setPw({ ...pw, password: v })} />
            <PasswordInput label="Confirmar nova senha" value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} />
            {fe("password") && <div className="sm:col-span-2">{fe("password")}</div>}
            {isWeakPassword(pw.password) && <p className="text-xs text-muted-foreground sm:col-span-2">Senha fraca — permitida, mas recomende trocar depois.</p>}
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><Checkbox checked={pw.requireChange} onCheckedChange={(v) => setPw({ ...pw, requireChange: v === true })} />Exigir que o usuário troque a senha no próximo acesso</label>
            <div className="sm:col-span-2"><Button type="button" variant="outline" disabled={busy} onClick={() => savePassword(row)}>Redefinir senha</Button></div>
          </div>
        </div>}
      </div>;
    })}
    <details className="rounded-md border p-3 text-sm"><summary className="cursor-pointer font-semibold">Trilha de alterações de usuários</summary>
      {!log.length ? <p className="mt-2 text-muted-foreground">Nenhuma alteração registrada.</p> : <ul className="mt-2 space-y-2">{log.map((l) => <li key={l.id} className="border-b pb-2"><p><strong>{l.action}</strong> em {l.target_label || "—"}</p><p className="text-xs text-muted-foreground">{new Date(l.changed_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · por {nameOf(l.actor_id)}{l.detail ? ` · ${l.detail}` : ""}</p></li>)}</ul>}
    </details>
  </section>;
}
