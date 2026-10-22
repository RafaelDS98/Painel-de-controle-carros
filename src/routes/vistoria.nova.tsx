import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PlateCombobox } from "@/components/plate-combobox";
import { SignaturePad } from "@/components/signature-pad";
import { cn } from "@/lib/utils";
import {
  countDamages,
  missingRequired,
  progress,
  STATUS_LABEL,
  type AnswerDraft,
  type CheckStatus,
} from "@/lib/vistoria";
import {
  compressPhoto,
  DRAFT_KEY,
  uploadDataUrl,
  useChecklistConfig,
  useOperationTypes,
} from "@/lib/vistoria-data";

export const Route = createFileRoute("/vistoria/nova")({
  validateSearch: (s: Record<string, unknown>) => ({
    placa: typeof s["placa"] === "string" ? s["placa"] : undefined,
    op: typeof s["op"] === "string" ? s["op"] : undefined,
    rascunho: s["rascunho"] === 1 || s["rascunho"] === "1" ? 1 : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nova vistoria | ANPEXC Vistorias" },
      { name: "description", content: "Checklist, fotos e assinaturas da vistoria do veículo." },
      { property: "og:title", content: "Nova vistoria | ANPEXC Vistorias" },
      {
        property: "og:description",
        content: "Checklist, fotos e assinaturas da vistoria do veículo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovaVistoria,
});

interface Draft {
  plate: string | null;
  opId: string;
  km: string;
  fuel: string;
  driver: string;
  client: string;
  notes: string;
  answers: Record<string, AnswerDraft>;
  sigInspector: string | null;
  sigDriver: string | null;
  savedAt?: number;
}

const FUEL = ["Reserva", "1/4", "1/2", "3/4", "Cheio"];
const STATUS_STYLE: Record<CheckStatus, string> = {
  bom: "bg-success text-success-foreground border-success",
  ruim: "bg-destructive text-destructive-foreground border-destructive",
  atencao: "bg-warning text-warning-foreground border-warning",
  na: "bg-muted text-foreground border-foreground/40",
};
type Tab = "campos" | "checklist" | "fotos" | "assinar";

function NovaVistoria() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const ops = useOperationTypes();
  const config = useChecklistConfig();
  const [tab, setTab] = useState<Tab>("campos");
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<Draft>(() => {
    if (search.rascunho && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) return JSON.parse(raw) as Draft;
      } catch {
        /* rascunho inválido */
      }
    }
    return {
      plate: search.placa ?? null,
      opId: "",
      km: "",
      fuel: "",
      driver: "",
      client: "",
      notes: "",
      answers: {},
      sigInspector: null,
      sigDriver: null,
    };
  });
  useEffect(() => {
    if (!d.opId && search.op && ops.data) {
      const o = ops.data.find((x) => x.name === search.op);
      if (o) setD((p) => ({ ...p, opId: o.id }));
    }
    return undefined;
  }, [ops.data, search.op, d.opId]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
      } catch {
        toast.error("Sem espaço no aparelho para guardar o rascunho com todas as fotos.");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [d]);

  const groups = useMemo(() => config.data ?? [], [config.data]);
  const allFields = useMemo(() => groups.flatMap((g) => g.fields), [groups]);
  const pct = progress(allFields, d.answers);
  const setAns = (id: string, patch: AnswerDraft) =>
    setD((p) => ({ ...p, answers: { ...p.answers, [id]: { ...p.answers[id], ...patch } } }));

  async function finish(): Promise<unknown> {
    if (!d.plate) return (setTab("campos"), toast.error("Escolha a placa do veículo."));
    if (!d.opId) return (setTab("campos"), toast.error("Escolha o tipo de operação."));
    const miss = missingRequired(allFields, d.answers);
    if (miss.length)
      return toast.error(
        `Faltam ${miss.length} obrigatório(s): ${miss
          .slice(0, 3)
          .map((f) => f.label)
          .join(", ")}…`,
      );
    if (!d.sigInspector) return toast.error("Falta a assinatura do vistoriador.");
    if (!navigator.onLine)
      return toast.warning(
        "Sem internet: a vistoria ficou guardada como rascunho, pendente de envio. Conclua quando a conexão voltar.",
        { duration: 7000 },
      );
    setSaving(true);
    try {
      const { data: veh } = await supabase
        .from("vehicles")
        .select("id")
        .eq("plate", d.plate)
        .maybeSingle();
      const op = ops.data?.find((o) => o.id === d.opId);
      const { data: ins, error } = await supabase
        .from("inspections")
        .insert({
          plate: d.plate,
          vehicle_id: veh?.id ?? null,
          operation_type_id: d.opId,
          operation_name: op?.name ?? null,
          km: d.km ? Number(d.km.replace(/\D/g, "")) : null,
          fuel: d.fuel || null,
          driver_name: d.driver || null,
          client_name: d.client || null,
          notes: d.notes || null,
          damage_count: countDamages(d.answers),
        })
        .select("id")
        .single();
      if (error) throw error;
      const base = `${ins.id}`;
      const sigI = await uploadDataUrl(`${base}/assinatura-vistoriador.png`, d.sigInspector);
      const sigD = d.sigDriver
        ? await uploadDataUrl(`${base}/assinatura-motorista.png`, d.sigDriver)
        : null;
      await supabase
        .from("inspections")
        .update({ inspector_signature: sigI, driver_signature: sigD } as never)
        .eq("id", ins.id)
        .then(
          () => undefined,
          () => undefined,
        );
      const rows = [];
      for (const g of groups)
        for (const f of g.fields) {
          const a = d.answers[f.id];
          if (!a) continue;
          const photo = a.photo ? await uploadDataUrl(`${base}/${f.id}.jpg`, a.photo) : null;
          rows.push({
            inspection_id: ins.id,
            field_id: f.id,
            group_name: g.name,
            label: f.label,
            kind: f.kind,
            status: a.status ?? null,
            value: a.value ?? null,
            photo_path: photo,
            note: a.note ?? null,
          });
        }
      if (rows.length) {
        const r = await supabase.from("inspection_answers").insert(rows);
        if (r.error) throw r.error;
      }
      localStorage.removeItem(DRAFT_KEY);
      await qc.invalidateQueries({ queryKey: ["inspections"] });
      toast.success("Vistoria concluída.");
      void navigate({ to: "/vistoria/$id", params: { id: ins.id } });
    } catch (e) {
      toast.error(`Não foi possível concluir: ${(e as Error).message}. O rascunho continua salvo.`);
    } finally {
      setSaving(false);
    }
    return undefined;
  }

  const tabs: { k: Tab; l: string }[] = [
    { k: "campos", l: "Campos" },
    { k: "checklist", l: "Checklist" },
    { k: "fotos", l: "Fotos" },
    { k: "assinar", l: "Assinar" },
  ];
  return (
    <div className="mx-auto w-full max-w-2xl pb-28">
      <div className="sticky top-16 z-[5] space-y-2 border-b bg-background/95 p-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <span className="rounded border bg-white px-2 py-0.5 font-mono font-bold text-black">
            {d.plate ?? "SEM PLACA"}
          </span>
          <span className="truncate text-muted-foreground">
            {ops.data?.find((o) => o.id === d.opId)?.name ?? "Tipo de operação"}
          </span>
          <span className="ml-auto font-medium">{pct}%</span>
        </div>
        <div className="h-1.5 rounded bg-muted">
          <div className="h-1.5 rounded bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-1">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={cn(
                "h-11 rounded-md text-sm font-medium",
                tab === t.k ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-3">
        {tab === "campos" && (
          <>
            <Section title="Veículo e operação">
              <label className="text-sm font-medium">Placa *</label>
              <PlateCombobox value={d.plate} onChange={(plate) => setD((p) => ({ ...p, plate }))} />
              <label className="text-sm font-medium">Tipo de operação *</label>
              <div className="grid grid-cols-2 gap-2">
                {ops.data?.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setD((p) => ({ ...p, opId: o.id }))}
                    className={cn(
                      "min-h-11 rounded-md border px-2 text-sm",
                      d.opId === o.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card",
                    )}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="Dados">
              <Input
                className="h-12"
                inputMode="numeric"
                placeholder="KM"
                value={d.km}
                onChange={(e) => setD((p) => ({ ...p, km: e.target.value }))}
              />
              <div className="grid grid-cols-5 gap-1">
                {FUEL.map((f) => (
                  <button
                    key={f}
                    onClick={() => setD((p) => ({ ...p, fuel: f }))}
                    className={cn(
                      "h-11 rounded-md border text-xs",
                      d.fuel === f
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-card",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <Input
                className="h-12"
                placeholder="Motorista"
                value={d.driver}
                onChange={(e) => setD((p) => ({ ...p, driver: e.target.value }))}
              />
              <Input
                className="h-12"
                placeholder="Cliente"
                value={d.client}
                onChange={(e) => setD((p) => ({ ...p, client: e.target.value }))}
              />
              <Textarea
                placeholder="Observações"
                value={d.notes}
                onChange={(e) => setD((p) => ({ ...p, notes: e.target.value }))}
              />
            </Section>
            {groups
              .filter((g) => g.tab === "campos")
              .map((g) => (
                <Section key={g.id} title={g.name}>
                  {g.fields.map((f) => (
                    <div key={f.id} className="space-y-1">
                      <FieldLabel label={f.label} required={f.required} />
                      <Input
                        className="h-12"
                        inputMode={f.kind === "number" ? "numeric" : undefined}
                        value={d.answers[f.id]?.value ?? ""}
                        onChange={(e) => setAns(f.id, { value: e.target.value })}
                      />
                    </div>
                  ))}
                </Section>
              ))}
            <Button className="h-12 w-full" onClick={() => setTab("checklist")}>
              Próximo: Checklist
            </Button>
          </>
        )}

        {tab === "checklist" &&
          groups
            .filter((g) => g.tab === "checklist")
            .map((g) => (
              <Section key={g.id} title={g.name}>
                {g.fields.map((f) => {
                  const a = d.answers[f.id];
                  const bad = a?.status === "ruim" || a?.status === "atencao";
                  return (
                    <div key={f.id} className="space-y-2 rounded-lg border p-3">
                      <FieldLabel label={f.label} required={f.required} />
                      {f.kind === "check" ? (
                        <div className="grid grid-cols-4 gap-1">
                          {(Object.keys(STATUS_LABEL) as CheckStatus[]).map((s) => (
                            <button
                              key={s}
                              onClick={() => setAns(f.id, { status: s })}
                              className={cn(
                                "h-12 rounded-md border text-sm font-semibold",
                                a?.status === s ? STATUS_STYLE[s] : "bg-card",
                              )}
                            >
                              {STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <Input
                          className="h-12"
                          value={a?.value ?? ""}
                          onChange={(e) => setAns(f.id, { value: e.target.value })}
                        />
                      )}
                      {bad && (
                        <div className="space-y-2">
                          <Input
                            placeholder="Descreva a avaria"
                            value={a?.note ?? ""}
                            onChange={(e) => setAns(f.id, { note: e.target.value })}
                          />
                          <PhotoInput
                            value={a?.photo}
                            onChange={(photo) => setAns(f.id, { photo })}
                            label="Foto da avaria"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </Section>
            ))}

        {tab === "fotos" &&
          groups
            .filter((g) => g.tab === "fotos")
            .map((g) => (
              <Section key={g.id} title={g.name}>
                <div className="grid grid-cols-2 gap-2">
                  {g.fields.map((f) => (
                    <PhotoInput
                      key={f.id}
                      label={f.label}
                      required={f.required}
                      value={d.answers[f.id]?.photo}
                      onChange={(photo) => setAns(f.id, { photo })}
                    />
                  ))}
                </div>
              </Section>
            ))}

        {tab === "assinar" && (
          <Section title="Assinaturas e conclusão">
            <SignaturePad
              label="Vistoriador *"
              value={d.sigInspector}
              onChange={(v) => setD((p) => ({ ...p, sigInspector: v }))}
            />
            <SignaturePad
              label="Motorista / cliente"
              value={d.sigDriver}
              onChange={(v) => setD((p) => ({ ...p, sigDriver: v }))}
            />
            <p className="text-sm text-muted-foreground">
              Avarias marcadas: <b>{countDamages(d.answers)}</b> · Progresso {pct}%
            </p>
          </Section>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-card/95 p-3 backdrop-blur md:left-60">
        <Button className="h-14 w-full text-base" disabled={saving} onClick={finish}>
          <CheckCircle2 className="h-5 w-5" />
          {saving ? "Enviando…" : "Concluir vistoria"}
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function FieldLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      {label}
      {required && (
        <Badge variant="outline" className="text-[10px]">
          Obrigatório
        </Badge>
      )}
    </div>
  );
}

function PhotoInput({
  label,
  required,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  value?: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  return (
    <label className="relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/40 text-center text-xs">
      {value ? (
        <img src={value} alt={label} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <Camera className="mb-1 h-6 w-6 text-muted-foreground" />
          <span className="px-1 font-medium">{label}</span>
          {required && <span className="text-[10px] text-destructive">Obrigatório</span>}
        </>
      )}
      {value && (
        <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[11px] text-white">
          {label} · toque para trocar
        </span>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await compressPhoto(f));
          e.target.value = "";
        }}
      />
    </label>
  );
}
