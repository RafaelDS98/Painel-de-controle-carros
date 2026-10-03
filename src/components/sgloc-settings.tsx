import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { runSglocProbe, saveSglocSettings, type ProbeStep } from "@/lib/sgloc/sgloc.functions";

type Result = { runAt: string; steps: ProbeStep[] };

export function buildReport(result: Result): string {
  const lines = [`Relatório de teste SGLOC (somente leitura) — ${new Date(result.runAt).toLocaleString("pt-BR")}`, "Dados pessoais mascarados (2 primeiros caracteres + ***).", ""];
  for (const s of result.steps) {
    lines.push(`${s.ok ? "✓" : "✗"} ${s.title} — HTTP ${s.httpStatus ?? "—"} — ${s.latencyMs ?? "—"} ms`, `  ${s.explanation}`, `  ${JSON.stringify(s.summary, null, 2).replace(/\n/g, "\n  ")}`, "");
  }
  return lines.join("\n");
}

export function SglocSettingsPanel() {
  const save = useServerFn(saveSglocSettings);
  const probe = useServerFn(runSglocProbe);
  const [baseUrl, setBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [timeout, setTimeoutSec] = useState(15);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>({});
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    void supabase.from("sgloc_settings").select("enabled, base_url, request_timeout_seconds").eq("id", true).maybeSingle().then(({ data }) => {
      setBaseUrl(data?.base_url ?? ""); setEnabled(data?.enabled ?? false); setTimeoutSec(data?.request_timeout_seconds ?? 15); setLoaded(true);
    });
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg({});
    try {
      const r = await save({ data: { baseUrl, enabled, timeoutSeconds: Number(timeout) || 15 } });
      setBaseUrl(r.baseUrl ?? ""); setMsg({ ok: "Configurações do SGLOC salvas." });
    } catch (err) { setMsg({ error: err instanceof Error ? err.message : "Não foi possível salvar." }); }
    setBusy(false);
  }
  async function onTest() {
    setBusy(true); setMsg({}); setResult(null);
    try { const r = await probe(); setResult(r); }
    catch (err) { setMsg({ error: err instanceof Error ? err.message : "Não foi possível testar." }); }
    setBusy(false);
  }
  async function copy() {
    if (!result) return;
    try { await navigator.clipboard.writeText(buildReport(result)); setMsg({ ok: "Relatório copiado (já mascarado)." }); }
    catch { setMsg({ error: "Não foi possível copiar; selecione o texto manualmente." }); }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return <section className="space-y-4">
    <p className="rounded-md border bg-muted px-3 py-2 text-sm">Este lote só <strong>LÊ</strong> do SGLOC: nada é criado ou alterado lá, e não há sincronização automática.</p>
    <form onSubmit={onSave} className="space-y-3">
      <label className="block text-sm">URL base do SGLOC<Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://servidor.exemplo.com.br" maxLength={300} inputMode="url" /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4" />Integração ativa</label>
      <label className="block text-sm">Tempo limite (segundos, 3 a 60)<Input type="number" min={3} max={60} value={timeout} onChange={(e) => setTimeoutSec(Number(e.target.value))} className="w-28" /></label>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>Salvar</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onTest}>{busy ? "Aguarde…" : "Testar integração"}</Button></div>
      <p className="text-xs text-muted-foreground">O teste usa a sua conta SGLOC conectada em Minha conta e pode ser repetido a cada 30 segundos.</p>
    </form>
    {msg.error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{msg.error}</p>}
    {msg.ok && <p role="status" className="text-sm text-muted-foreground">{msg.ok}</p>}
    {result && <div className="space-y-2">
      <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Resultado</h3><Button size="sm" variant="outline" onClick={copy}>Copiar relatório</Button></div>
      <ul className="space-y-2">{result.steps.map((s) => <li key={s.step} className="rounded-md border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><span aria-label={s.ok ? "Sucesso" : "Falha"} className={s.ok ? "text-primary" : "text-destructive"}>{s.ok ? "✓" : "✗"}</span><strong>{s.title}</strong>
          <span className="text-xs text-muted-foreground">HTTP {s.httpStatus ?? "—"} · {s.latencyMs ?? "—"} ms</span></div>
        <p className="mt-1">{s.explanation}</p>
        <details className="mt-1"><summary className="cursor-pointer text-xs text-muted-foreground">Detalhes (mascarados)</summary><pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">{JSON.stringify(s.summary, null, 2)}</pre></details>
      </li>)}</ul>
    </div>}
  </section>;
}
