import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/my-account";
import { connectSglocAccount, disconnectSglocAccount } from "@/lib/sgloc/sgloc.functions";
import { tokenState } from "@/lib/sgloc/core";

type Status = { connected: boolean; sgloc_email: string | null; token_expires_at: string | null };

export function SglocAccountSection() {
  const connect = useServerFn(connectSglocAccount);
  const disconnect = useServerFn(disconnectSglocAccount);
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  async function load() {
    const { data, error } = await supabase.rpc("get_my_sgloc_status");
    const row = Array.isArray(data) ? data[0] : null;
    setStatus(error || !row ? { connected: false, sgloc_email: null, token_expires_at: null } : row);
  }
  useEffect(() => { void load(); }, []);

  async function onConnect(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    try { await connect({ data: { email, password } }); setPassword(""); setMsg({ ok: "Conta SGLOC conectada." }); await load(); }
    catch (err) { setPassword(""); setMsg({ error: err instanceof Error ? err.message : "Não foi possível conectar." }); }
    setBusy(false);
  }
  async function onDisconnect() {
    setBusy(true); setMsg({});
    try { await disconnect(); setMsg({ ok: "Conta SGLOC desconectada." }); await load(); }
    catch (err) { setMsg({ error: err instanceof Error ? err.message : "Não foi possível desconectar." }); }
    setBusy(false);
  }

  const state = !status?.connected ? "none" : tokenState(status.token_expires_at);
  const label = state === "none" ? "Não conectada" : state === "expired" ? "Expirada" : "Conectada";
  return <section className="space-y-2 border-t pt-4">
    <h3 className="font-semibold">Conta SGLOC</h3>
    {!status ? <p className="text-sm text-muted-foreground">Carregando…</p> : <>
      <p className="text-sm">Situação: <strong>{label}</strong>{status.sgloc_email ? ` (${status.sgloc_email})` : ""}
        {state === "connected" && status.token_expires_at ? ` · válida até ${new Date(status.token_expires_at).toLocaleString("pt-BR")}` : ""}</p>
      {state !== "connected" && <form onSubmit={onConnect} className="space-y-2">
        <label className="block text-sm">E-mail do SGLOC<Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} /></label>
        <PasswordInput label="Senha do SGLOC (não é guardada)" value={password} onChange={setPassword} autoComplete="off" />
        <Button type="submit" size="sm" disabled={busy}>Conectar</Button>
      </form>}
      {status.connected && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onDisconnect}>Desconectar</Button>}
    </>}
    {msg.error && <p role="alert" className="text-sm text-destructive">{msg.error}</p>}
    {msg.ok && <p role="status" className="text-sm text-muted-foreground">{msg.ok}</p>}
  </section>;
}
