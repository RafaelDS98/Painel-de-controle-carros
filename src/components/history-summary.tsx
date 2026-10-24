import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { summarizeAppointmentHistory } from "@/lib/history-summary.functions";

type Result = {
  summary: string;
  counts?: { data: number; oficina: number; situacao: number };
  error?: string;
};

/** Botão que gera, sob demanda, o resumo por IA das alterações de um atendimento. */
export function AppointmentSummary({ appointmentId }: { appointmentId: string }) {
  const run = useServerFn(summarizeAppointmentHistory);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function generate() {
    setBusy(true);
    try {
      setResult(await run({ data: { appointmentId } }));
    } catch {
      setResult({ summary: "", error: "Não foi possível gerar o resumo agora." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void generate()}>
        <Sparkles /> {busy ? "Resumindo…" : result ? "Gerar de novo" : "Resumo das alterações"}
      </Button>
      {result?.counts && (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">Datas: {result.counts.data}</Badge>
          <Badge variant="secondary">Oficina: {result.counts.oficina}</Badge>
          <Badge variant="secondary">Situação: {result.counts.situacao}</Badge>
        </div>
      )}
      {result?.error && (
        <p role="alert" className="text-sm text-destructive">
          {result.error}
        </p>
      )}
      {result?.summary && (
        <p className="rounded-md bg-muted p-2 text-sm leading-relaxed text-foreground">
          {result.summary}
        </p>
      )}
    </div>
  );
}
