import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { runSglocSyncNow } from "@/lib/sgloc/sgloc.functions";

type Run = { started_at: string; status: string; dry_run: boolean; trigger_source: string; inserted: number; updated: number; errors: number };
const when = (v: string) => new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Faixa no topo da agenda: última sincronização SGLOC, aviso de falha e "Sincronizar agora" (master). Gerente/master leem as execuções. */
export function SglocSyncBar({ role, onSynced }: { role: string; onSynced: () => Promise<void> }) {
  const runNow = useServerFn(runSglocSyncNow);
  const [live, setLive] = useState<boolean | null>(null);
  const [last, setLast] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const allowed = role === "master" || role === "gerente";

  const load = useCallback(async () => {
    const [settings, runs] = await Promise.all([
      supabase.from("sgloc_settings").select("enabled, sync_live").eq("id", true).maybeSingle(),
      supabase.from("sgloc_sync_runs").select("started_at, status, dry_run, trigger_source, inserted, updated, errors").neq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setLive(Boolean(settings.data?.enabled && settings.data?.sync_live));
    setLast((runs.data as Run | null) ?? null);
  }, []);
  useEffect(() => { if (allowed) void load().catch(() => undefined); }, [allowed, load]);
  if (!allowed || live === null) return null;

  async function sync() {
    setBusy(true); setMsg({});
    try {
      const result = await runNow({ data: { simulate: !live } });
      setMsg(result.status === "failed" ? { error: result.message } : { ok: result.message });
      await load(); if (live) await onSynced();
    } catch (caught) { setMsg({ error: caught instanceof Error ? caught.message : "Não foi possível sincronizar." }); }
    setBusy(false);
  }
  const failed = last && (last.status === "failed" || last.status === "abandoned");
  const real = last && !last.dry_run;
  return <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card px-4 py-2 text-sm" aria-label="Sincronização SGLOC">
    <span className="font-medium">SGLOC</span>
    <span className={live ? "" : "text-muted-foreground"}>{live ? "Sincronização automática ligada" : "Sincronização automática desligada (a agenda não recebe dados do SGLOC)"}</span>
    <span className="text-muted-foreground">{last ? `· Última execução: ${when(last.started_at)}${last.dry_run ? " (simulação)" : ""}${real ? ` · ${last.inserted} novo(s), ${last.updated} atualizado(s)` : ""}` : "· Nenhuma execução ainda"}</span>
    {failed && <span role="alert" className="font-semibold text-destructive">A última sincronização falhou. Veja os detalhes em Configurações &gt; SGLOC.</span>}
    {role === "master" && <Button size="sm" variant="outline" className="ml-auto" disabled={busy} onClick={() => void sync()}><RefreshCw className={busy ? "animate-spin" : ""} /> {live ? "Sincronizar agora" : "Simular agora"}</Button>}
    {msg.error && <span role="alert" className="w-full text-destructive">{msg.error}</span>}
    {msg.ok && <span role="status" className="w-full text-muted-foreground">{msg.ok}</span>}
  </div>;
}
