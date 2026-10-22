import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Share2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMyPermissions } from "@/lib/permissions";
import { STATUS_LABEL, type CheckStatus } from "@/lib/vistoria";
import { signedUrls } from "@/lib/vistoria-data";

export const Route = createFileRoute("/vistoria/$id")({
  head: () => ({
    meta: [
      { title: "Detalhe da vistoria | ANPEXC Vistorias" },
      { name: "description", content: "Laudo da vistoria com checklist, fotos e assinaturas." },
      { property: "og:title", content: "Detalhe da vistoria | ANPEXC Vistorias" },
      { property: "og:description", content: "Laudo da vistoria com checklist, fotos e assinaturas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Detalhe,
});

const COLOR: Record<string, string> = { bom: "text-success", ruim: "text-destructive", atencao: "text-warning", na: "text-muted-foreground" };

function Detalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const perms = useMyPermissions();
  const [big, setBig] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const q = useQuery({
    queryKey: ["inspections", "detail", id],
    queryFn: async () => {
      const [i, a] = await Promise.all([
        supabase.from("inspections").select("*").eq("id", id).single(),
        supabase.from("inspection_answers").select("*").eq("inspection_id", id),
      ]);
      if (i.error) throw i.error;
      const ins = i.data;
      const [veh, prof] = await Promise.all([
        supabase.from("vehicles").select("modelo,ano").eq("plate", ins.plate).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", ins.inspector_id).maybeSingle(),
      ]);
      const urls = await signedUrls([
        ...(a.data ?? []).map((x) => x.photo_path ?? ""),
        ins.inspector_signature ?? "",
        ins.driver_signature ?? "",
      ]);
      return { ins, answers: a.data ?? [], veh: veh.data, inspector: prof.data?.full_name ?? "—", urls };
    },
  });
  if (q.isLoading) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  if (!q.data) return <p className="p-6 text-sm text-destructive">Vistoria não encontrada.</p>;
  const { ins, answers, veh, inspector, urls } = q.data;
  const photos = answers.filter((a) => a.photo_path && urls[a.photo_path]);
  const groups = [...new Set(answers.filter((a) => a.kind !== "photo").map((a) => a.group_name ?? ""))];
  async function cancel() {
    const { error } = await supabase.from("inspections").update({ status: "cancelada", cancel_reason: reason }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vistoria cancelada.");
    setCancelOpen(false);
    void qc.invalidateQueries({ queryKey: ["inspections"] });
  }
  const share = () => {
    const text = `Vistoria #${ins.number} · ${ins.plate} · ${ins.operation_name ?? ""} · ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 print:p-0">
      <div className="rounded-xl bg-sidebar p-4 text-sidebar-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded border bg-white px-2 py-0.5 font-mono text-lg font-bold text-black">{ins.plate}</span>
          <div className="text-sm">
            <div className="font-semibold">Vistoria #{ins.number} · {ins.operation_name ?? "—"}</div>
            <div className="opacity-80">{veh?.modelo ?? "—"} {veh?.ano ?? ""} · KM {ins.km ?? "—"} · {ins.fuel ?? "—"} · {inspector} · {new Date(ins.created_at).toLocaleString("pt-BR")}</div>
          </div>
          <div className="ml-auto flex gap-2 print:hidden">
            <Button size="sm" variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> Laudo PDF</Button>
            <Button size="sm" variant="secondary" onClick={share}><Share2 className="h-4 w-4" /> WhatsApp</Button>
          </div>
        </div>
        {ins.status === "cancelada" && <p className="mt-2 rounded bg-destructive px-2 py-1 text-sm text-destructive-foreground">Cancelada: {ins.cancel_reason}</p>}
      </div>
      <div className="grid gap-2 rounded-xl border bg-card p-4 text-sm sm:grid-cols-3">
        <div><span className="text-muted-foreground">Motorista:</span> {ins.driver_name ?? "—"}</div>
        <div><span className="text-muted-foreground">Cliente:</span> {ins.client_name ?? "—"}</div>
        <div><span className="text-muted-foreground">Avarias:</span> <b className={ins.damage_count ? "text-destructive" : ""}>{ins.damage_count}</b></div>
        {ins.notes && <div className="sm:col-span-3"><span className="text-muted-foreground">Obs.:</span> {ins.notes}</div>}
      </div>
      {groups.map((g) => (
        <section key={g} className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-semibold">{g}</h2>
          <ul className="divide-y text-sm">
            {answers.filter((a) => a.group_name === g && a.kind !== "photo").map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1">{a.label}</span>
                {a.note && <span className="text-xs text-muted-foreground">{a.note}</span>}
                {a.photo_path && urls[a.photo_path] && <button onClick={() => setBig(urls[a.photo_path!] ?? null)} className="text-xs text-link">foto</button>}
                <b className={COLOR[a.status ?? ""] ?? ""}>{a.status ? STATUS_LABEL[a.status as CheckStatus] : a.value}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="mb-2 font-semibold">Fotos ({photos.length})</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <button key={p.id} onClick={() => setBig(urls[p.photo_path!] ?? null)} className="overflow-hidden rounded-lg border text-left">
              <img src={urls[p.photo_path!]} alt={p.label} className="aspect-[4/3] w-full object-cover" />
              <span className="block truncate px-2 py-1 text-xs">{p.label}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        {[["Vistoriador", ins.inspector_signature], ["Motorista / cliente", ins.driver_signature]].map(([l, p]) => (
          <div key={l} className="text-sm">
            <div className="mb-1 text-muted-foreground">{l}</div>
            {p && urls[p] ? <img src={urls[p]} alt={`Assinatura ${l}`} className="h-24 rounded border bg-white object-contain" /> : "—"}
          </div>
        ))}
      </section>
      <div className="flex gap-2 print:hidden">
        <Button asChild variant="outline"><Link to="/vistoria/placa" search={{ placa: ins.plate }}>Histórico da placa</Link></Button>
        {perms.data?.has("action.inspection_cancel") && ins.status !== "cancelada" && (
          <Button variant="destructive" className="ml-auto" onClick={() => setCancelOpen(!cancelOpen)}><XCircle className="h-4 w-4" /> Cancelar vistoria</Button>
        )}
      </div>
      {cancelOpen && (
        <div className="space-y-2 rounded-xl border border-destructive p-4 print:hidden">
          <Textarea placeholder="Motivo do cancelamento (obrigatório)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="destructive" disabled={!reason.trim()} onClick={cancel}>Confirmar cancelamento</Button>
        </div>
      )}
      {big && (
        <button onClick={() => setBig(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <img src={big} alt="Foto ampliada" className="max-h-full max-w-full object-contain" />
        </button>
      )}
    </div>
  );
}
