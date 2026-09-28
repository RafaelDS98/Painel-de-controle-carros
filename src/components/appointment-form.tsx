import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AppointmentFields = {
  date: string; time: string; plate: string; store: string; model: string;
  contact: string; workshop: string; issue: string; note: string;
  operator: string; externalOrder: string; currentDeadline: string;
};

export const emptyFields: AppointmentFields = {
  date: "", time: "", plate: "", store: "", model: "", contact: "",
  workshop: "", issue: "", note: "", operator: "", externalOrder: "", currentDeadline: "",
};

export const columnForField: Record<keyof AppointmentFields, string> = {
  date: "date", time: "time", plate: "plate", store: "store", model: "model",
  contact: "contact", workshop: "workshop", issue: "issue", note: "note",
  operator: "operator", externalOrder: "external_order", currentDeadline: "current_deadline",
};

const fields: { key: keyof AppointmentFields; label: string; type?: string; wide?: boolean }[] = [
  { key: "date", label: "Data Atendimento", type: "date" },
  { key: "time", label: "Hora", type: "time" },
  { key: "plate", label: "Placa" },
  { key: "store", label: "Loja" },
  { key: "model", label: "Modelo" },
  { key: "contact", label: "Contato" },
  { key: "workshop", label: "Local/Oficina" },
  { key: "issue", label: "Problema Relatado", wide: true },
  { key: "note", label: "Observação", wide: true },
  { key: "operator", label: "Operador" },
  { key: "externalOrder", label: "O.S Externa" },
  { key: "currentDeadline", label: "Previsão de Entrega", type: "date" },
];

export function AppointmentForm({ initial, editing = false, blocked, onSave }: {
  initial: AppointmentFields;
  editing?: boolean;
  blocked?: string | null;
  onSave: (changes: Partial<AppointmentFields>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<AppointmentFields>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(initial); }, [initial]);

  const changes = Object.fromEntries(
    (Object.keys(initial) as (keyof AppointmentFields)[])
      .filter((key) => draft[key] !== initial[key])
      .map((key) => [key, draft[key]]),
  ) as Partial<AppointmentFields>;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || saving) return;
    setSaving(true);
    try { await onSave(editing ? changes : draft); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={Boolean(blocked) || saving} className="grid gap-4 disabled:opacity-70 sm:grid-cols-2">
        {fields.map(({ key, label, type, wide }) => (
          <label key={key} className={wide ? "sm:col-span-2" : ""}>
            <span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">{label}{!editing && (key === "date" || key === "time" || key === "plate") ? " *" : ""}</span>
            {wide ? <textarea value={draft[key]} onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))} rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
              : <Input type={type ?? "text"} value={draft[key]} required={!editing && (key === "date" || key === "time" || key === "plate")} onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))} />}
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end">
        <Button type="submit" disabled={Boolean(blocked) || saving || (editing && Object.keys(changes).length === 0)}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar agendamento"}</Button>
      </div>
    </form>
  );
}