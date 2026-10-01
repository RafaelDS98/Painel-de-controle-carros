import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FieldDefinition, CustomValues } from "@/lib/agenda-config";

export type AppointmentFields = {
  date: string; time: string; plate: string; store: string; model: string;
  contact: string; workshop: string; issue: string; note: string;
  operator: string; externalOrder: string; currentDeadline: string;
  customFields: CustomValues;
};

export const emptyFields: AppointmentFields = {
  date: "", time: "", plate: "", store: "", model: "", contact: "",
  workshop: "", issue: "", note: "", operator: "", externalOrder: "", currentDeadline: "", customFields: {},
};

export const columnForField: Record<Exclude<keyof AppointmentFields, "customFields">, string> = {
  date: "date", time: "time", plate: "plate", store: "store", model: "model",
  contact: "contact", workshop: "workshop", issue: "issue", note: "note",
  operator: "operator", externalOrder: "external_order", currentDeadline: "current_deadline",
};
const fieldForColumn = Object.fromEntries(Object.entries(columnForField).map(([key, column]) => [column, key])) as Record<string, keyof AppointmentFields>;
const baseFields = [
  { key: "date", label: "Data Atendimento", type: "date" },
  { key: "time", label: "Hora", type: "time" },
  { key: "plate", label: "Placa", type: "text" },
] as const;

export function AppointmentForm({ initial, definitions, editing = false, blocked, onSave }: {
  initial: AppointmentFields;
  definitions: FieldDefinition[];
  editing?: boolean;
  blocked?: string | null;
  onSave: (changes: Partial<AppointmentFields>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<AppointmentFields>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(initial); }, [JSON.stringify(initial)]);
  const changes: Partial<AppointmentFields> = {};
  for (const key of Object.keys(columnForField) as (keyof typeof columnForField)[]) {
    if (draft[key] !== initial[key]) Object.assign(changes, { [key]: draft[key] });
  }
  const customChanges = Object.fromEntries(Object.entries(draft.customFields).filter(([key, value]) => value !== (initial.customFields[key] ?? "")));
  if (Object.keys(customChanges).length) changes.customFields = customChanges;

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
        {baseFields.map(({ key, label, type }) => <label key={key}><span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">{label}{!editing ? " *" : ""}</span><Input type={type} value={draft[key]} required={!editing} onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))} /></label>)}
        {definitions.filter((field) => field.visible).map((field) => {
          const key = fieldForColumn[field.field_key];
          const value = field.storage === "custom" ? draft.customFields[field.field_key] ?? "" : String(key ? draft[key] : "");
          const setValue = (next: string) => setDraft((prev) => field.storage === "custom"
            ? { ...prev, customFields: { ...prev.customFields, [field.field_key]: next } }
            : key ? { ...prev, [key]: next } : prev);
          const options = Array.isArray(field.select_options) ? field.select_options.filter((option): option is string => typeof option === "string") : [];
          return <label key={field.id} className={field.field_type === "textarea" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">{field.label}{field.required ? " *" : ""}</span>
            {field.field_type === "textarea" ? <textarea value={value} required={field.required} onChange={(event) => setValue(event.target.value)} rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
              : field.field_type === "select" ? <select value={value} required={field.required} onChange={(event) => setValue(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Selecione</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              : <Input type={field.field_type === "date" ? "date" : "text"} value={value} required={field.required} onChange={(event) => setValue(event.target.value)} />}
          </label>;
        })}
      </fieldset>
      <div className="flex justify-end"><Button type="submit" disabled={Boolean(blocked) || saving || (editing && Object.keys(changes).length === 0)}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar agendamento"}</Button></div>
    </form>
  );
}
