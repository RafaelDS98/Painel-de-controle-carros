import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ReworkFields = {
  date: string; time: string; plate: string; model: string; contact: string;
  workshop: string; operator: string; reason: string;
};

const fields: { key: keyof ReworkFields; label: string; type?: string; required?: boolean }[] = [
  { key: "date", label: "Nova data de atendimento", type: "date", required: true },
  { key: "time", label: "Nova hora", type: "time", required: true },
  { key: "plate", label: "Placa", required: true },
  { key: "model", label: "Modelo" },
  { key: "contact", label: "Contato" },
  { key: "workshop", label: "Local/Oficina" },
  { key: "operator", label: "Operador" },
];

export function ReworkForm({ initial, onSave }: { initial: ReworkFields; onSave: (fields: ReworkFields) => Promise<boolean> }) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try { await onSave(draft); }
    finally { setSaving(false); }
  }

  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
      {fields.map(({ key, label, type, required }) => <label key={key}>
        <span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">{label}{required ? " *" : ""}</span>
        <Input type={type ?? "text"} value={draft[key]} required={required} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
      </label>)}
      <label className="sm:col-span-2">
        <span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Motivo do retorno *</span>
        <textarea required rows={3} value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
      </label>
    </fieldset>
    <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Registrar retrabalho"}</Button></div>
  </form>;
}