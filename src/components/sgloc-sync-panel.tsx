import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { announceAgendaChange } from "@/lib/agenda-freshness";
import { getSglocSyncStatus, listSglocConnectedUsers, runSglocSyncNow, saveSglocSettings } from "@/lib/sgloc/sgloc.functions";

type Status = Awaited<ReturnType<typeof getSglocSyncStatus>>;
type Run = NonNullable<Status["last"]>;
type User = { userId: string; name: string; sglocEmail: string; expiresAt: string | null };

const when = (v: string | null | undefined) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const statusLabel: Record<string, string> = { success: "Concluída", partial: "Concluída com avisos", failed: "Falhou", running: "Em andamento", abandoned: "Interrompida" };

function RunCard({ run, title }: { run: Run; title: string }) {
  const detail = Array.isArray(run.error_detail) ? (run.error_detail as { message?: string; kind?: string }[]) : [];
  return <div className="rounded-md border p-3 text-sm">
    <p className="font-medium">{title}: {when(run.started_at)} · {run.trigger_source === "manual" ? "manual" : "agendada"}{run.dry_run ? " · simulação" : ""} · {statusLabel[run.status] ?? run.status}</p>
    {run.dry_run && <p className="mt-1 font-medium">Simulação: nada foi gravado na agenda.</p>}
    <p className="mt-1 text-muted-foreground">Lidos {run.fetched} · {run.dry_run ? "criaria" : "criados"} {run.inserted} · {run.dry_run ? "atualizaria" : "atualizados"} {run.updated} · vinculados {run.linked} · não retornados {run.not_returned} · protegidos {run.protected} · ambíguos {run.ambiguous} · ignorados {run.skipped} · erros {run.errors}</p>
    {detail[0]?.message && <p className="mt-1 text-destructive">{detail[0].message}</p>}
  </div>;
}

/** Configurações e status da sincronização automática SGLOC → painel (só master). */
export function SglocSyncPanel({ base }: { base: { baseUrl: string; enabled: boolean; writeEnabled: boolean; timeoutSeconds: number } }) {
  const status = useServerFn(getSglocSyncStatus);
  const users = useServerFn(listSglocConnectedUsers);
  const save = useServerFn(saveSglocSettings);
  const run = useServerFn(runSglocSyncNow);
  const [st, setSt] = useState<Status | null>(null);
  const [list, setList] = useState<User[]>([]);
  const [hours, setHours] = useState(8); const [mins, setMins] = useState(0);
  const [back, setBack] = useState(7); const [ahead, setAhead] = useState(45);
  const [userId, setUserId] = useState<string>(""); const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});

  const reload = useCallback(async () => {
    const [s, u] = await Promise.all([status(), users().catch(() => [] as User[])]);
    setSt(s); setList(u);
    setHours(Math.floor(s.settings.intervalMinutes / 60)); setMins(s.settings.intervalMinutes % 60);
    setBack(s.settings.windowDaysBack); setAhead(s.settings.windowDaysAhead); setUserId(s.settings.syncUserId ?? ""); setLive(s.settings.syncLive);
  }, [status, users]);
  useEffect(() => { void reload().catch((e) => setMsg({ error: e instanceof Error ? e.message : "Não foi possível carregar." })); }, [reload]);

  async function onSave() {
    const total = (Number(hours) || 0) * 60 + (Number(mins) || 0);
    if (total < 15 || total > 1440) { setMsg({ error: "Intervalo deve ficar entre 15 minutos e 24 horas." }); return; }
    if (live && !st?.settings.syncLive && !window.confirm("Ligar a sincronização de verdade? A partir daí o painel passa a receber criações e alterações do SGLOC.")) return;
    setBusy(true); setMsg({});
    try {
      await save({ data: { ...base, intervalMinutes: total, windowDaysBack: Number(back), windowDaysAhead: Number(ahead), syncUserId: userId || null, syncLive: live } });
      setMsg({ ok: "Sincronização salva." }); await reload();
    } catch (e) { setMsg({ error: e instanceof Error ? e.message : "Não foi possível salvar." }); }
    setBusy(false);
  }
  async function onRun(simulate: boolean) {
    setBusy(true); setMsg({});
    try {
      const r = await run({ data: { simulate } }); setMsg(r.status === "failed" ? { error: r.message } : { ok: r.message }); await reload();
      announceAgendaChange({ source: r.dryRun ? "simulation" : "sync", inserted: r.counts?.["inserted"] ?? 0, updated: (r.counts?.["updated"] ?? 0) + (r.counts?.["linked"] ?? 0) });
    }
    catch (e) { setMsg({ error: e instanceof Error ? e.message : "Não foi possível executar." }); }
    setBusy(false);
  }

  if (!st) return <p className="text-sm text-muted-foreground">Carregando sincronização…</p>;
  return <section className="space-y-3 border-t pt-4">
    <h3 className="font-semibold">Sincronização automática (SGLOC → painel)</h3>
    <p className="rounded-md border bg-muted px-3 py-2 text-sm">{st.settings.syncLive ? "Modo real: a cada intervalo o painel lê a agenda do SGLOC e grava criações e alterações." : "Modo simulação: as execuções só contam o que seria criado ou alterado, sem gravar nada no painel."} O painel continua sendo a fonte: agendamentos aguardando envio ou com falha no envio nunca são sobrescritos.</p>
    {st.accountWarning && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{st.accountWarning}</p>}
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="block">Intervalo (horas)<Input type="number" min={0} max={24} value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-24" /></label>
      <label className="block">e minutos<Input type="number" min={0} max={59} value={mins} onChange={(e) => setMins(Number(e.target.value))} className="w-24" /></label>
      <label className="block">Dias para trás<Input type="number" min={0} max={60} value={back} onChange={(e) => setBack(Number(e.target.value))} className="w-24" /></label>
      <label className="block">Dias para frente<Input type="number" min={0} max={180} value={ahead} onChange={(e) => setAhead(Number(e.target.value))} className="w-24" /></label>
    </div>
    <label className="block text-sm">Conta SGLOC usada pela rotina (só leitura)
      <select value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1 block min-h-11 w-full rounded-md border bg-background px-3 text-sm">
        <option value="">— nenhuma —</option>
        {list.map((u) => <option key={u.userId} value={u.userId}>{u.name || "Usuário sem nome"} · {u.sglocEmail}{u.expiresAt && Date.parse(u.expiresAt) <= Date.now() ? " (expirada)" : ""}</option>)}
      </select></label>
    <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="h-4 w-4" />Sincronização de verdade (exige simulação concluída nas últimas 24 h)</label>
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy} onClick={onSave}>Salvar sincronização</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => onRun(true)}>Simular agora</Button>
      <Button type="button" variant="outline" disabled={busy || !st.settings.syncLive} onClick={() => onRun(false)}>Sincronizar agora</Button>
    </div>
    {msg.error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg.error}</p>}
    {msg.ok && <p role="status" className="text-sm text-muted-foreground">{msg.ok}</p>}
    <p className="text-sm">Próxima prevista: <strong>{st.nextRunAt ? when(st.nextRunAt) : "desligada"}</strong></p>
    {st.last ? <RunCard run={st.last} title="Última execução" /> : <p className="text-sm text-muted-foreground">Nenhuma sincronização executada ainda.</p>}
    {st.lastSimulation && st.lastSimulation.id !== st.last?.id && <RunCard run={st.lastSimulation} title="Última simulação" />}
  </section>;
}
