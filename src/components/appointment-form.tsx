import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FieldDefinition, CustomValues } from "@/lib/agenda-config";
import { normalizePlate, parseKm, phonePattern } from "@/lib/normalize";

export type AppointmentFields = {
  date: string; time: string; plate: string; store: string; model: string;
  contact: string; workshop: string; issue: string; note: string;
  operator: string; externalOrder: string; currentDeadline: string;
  brand: string; contactNumber: string; kmScheduled: string;
  customFields: CustomValues;
  /** Só na edição: gravados no mesmo Salvar dos demais campos. */
  status?: string; priorityUrgent?: boolean;
};

export const emptyFields: AppointmentFields = {
  date: "", time: "", plate: "", store: "", model: "", contact: "",
  workshop: "", issue: "", note: "", operator: "", externalOrder: "", currentDeadline: "", brand: "", contactNumber: "", kmScheduled: "", customFields: {},
};

export const columnForField: Record<Exclude<keyof AppointmentFields, "customFields">, string> = {
  date: "date", time: "time", plate: "plate", store: "store", model: "model",
  contact: "contact", workshop: "workshop", issue: "issue", note: "note",
  operator: "operator", externalOrder: "external_order", currentDeadline: "current_deadline",
  brand: "brand", contactNumber: "contact_number", kmScheduled: "km_scheduled",
};
const readOnlyColumns = new Set(["os_number"]);
const hints: Record<string, string> = { km_scheduled: "O SGLOC confere este valor com o odômetro do veículo ao enviar" };
const fieldForColumn = Object.fromEntries(Object.entries(columnForField).map(([key, column]) => [column, key])) as Record<string, keyof AppointmentFields>;
const baseFields = [
  { key: "date", label: "Data Atendimento", type: "date" },
  { key: "time", label: "Hora", type: "time" },
  { key: "plate", label: "Placa", type: "text" },
] as const;

export function AppointmentForm({ initial, definitions, editing = false, blocked, onSave, statusOptions, canUrgent = false, onDirtyChange }: {
  statusOptions?: string[];
  canUrgent?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  initial: AppointmentFields;
  definitions: FieldDefinition[];
  editing?: boolean;
  blocked?: string | null;
  onSave: (changes: Partial<AppointmentFields>) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<AppointmentFields>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(initial); }, [JSON.stringify(initial)]);
  const changes: Partial<AppointmentFields> = {};
  for (const key of Object.keys(columnForField) as (keyof typeof columnForField)[]) {
    if (draft[key] !== initial[key]) Object.assign(changes, { [key]: draft[key] });
  }
  const customChanges = Object.fromEntries(Object.entries(draft.customFields).filter(([key, value]) => value !== (initial.customFields[key] ?? "")));
  if (Object.keys(customChanges).length) changes.customFields = customChanges;
  if (editing && statusOptions && (draft.status ?? "") !== (initial.status ?? "")) changes.status = draft.status ?? "";
  if (editing && canUrgent && Boolean(draft.priorityUrgent) !== Boolean(initial.priorityUrgent)) changes.priorityUrgent = Boolean(draft.priorityUrgent);
  const dirty = Object.keys(changes).length > 0;
  useEffect(() => { onDirtyChange?.(editing && dirty); }, [dirty, editing]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || saving) return;
    if (parseKm(draft.kmScheduled) === undefined) { setError("KM do agendamento deve ser um número inteiro maior ou igual a zero."); return; }
    if (!phonePattern.test(draft.contactNumber)) { setError("Telefone do contato aceita apenas números, espaços, parênteses, hífen e +."); return; }
    if (!editing && !normalizePlate(draft.plate)) { setError("Informe uma placa válida (letras e números)."); return; }
    setError("");
    setSaving(true);
    try { await onSave(editing ? changes : draft); }
    finally { setSaving(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={Boolean(blocked) || saving} className="grid gap-4 disabled:opacity-70 sm:grid-cols-2">
        {editing && statusOptions && <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Situação do veículo</span>
          <select value={draft.status ?? ""} onChange={(event) => setDraft((prev) => ({ ...prev, status: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground">
            <option value="">Não atualizada</option>{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            {draft.status && !statusOptions.includes(draft.status) && <option value={draft.status}>{draft.status}</option>}
          </select></label>}
        {editing && statusOptions && <label className="flex min-h-11 items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" className="size-4 accent-destructive" checked={Boolean(draft.priorityUrgent)} disabled={!canUrgent} onChange={(event) => setDraft((prev) => ({ ...prev, priorityUrgent: event.target.checked }))} />Marcar como urgente{!canUrgent && <span className="text-xs font-normal text-muted-foreground">(somente gerente ou master)</span>}</label>}
        {baseFields.map(({ key, label, type }) => <label key={key}><span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">{label}{!editing ? " *" : ""}</span><Input type={type} value={draft[key]} required={!editing} onChange={(event) => setDraft((prev) => ({ ...prev, [key]: event.target.value }))} /></label>)}
        {definitions.filter((field) => field.visible && !readOnlyColumns.has(field.field_key)).map((field) => {
          const key = fieldForColumn[field.field_key];
          const value = field.storage === "custom" ? draft.customFields[field.field_key] ?? "" : String(key ? draft[key] : "");
          const setValue = (next: string) => setDraft((prev) => field.storage === "custom"
            ? { ...prev, customFields: { ...prev.customFields, [field.field_key]: next } }
            : key ? { ...prev, [key]: next } : prev);
          const options = Array.isArray(field.select_options) ? field.select_options.filter((option): option is string => typeof option === "string") : [];
          return <label key={field.id} className={field.field_type === "textarea" ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">{field.label}{field.required ? " *" : ""}</span>
            {field.field_type === "textarea" ? <textarea value={value} required={field.required} onChange={(event) => setValue(event.target.value)} rows={2} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring" />
              : field.field_type === "select" ? <select value={value} required={field.required} onChange={(event) => setValue(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Selecione</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              : <Input type={field.field_type === "date" ? "date" : "text"} inputMode={field.field_key === "km_scheduled" ? "numeric" : field.field_key === "contact_number" ? "tel" : undefined} value={value} required={field.required} onChange={(event) => setValue(event.target.value)} />}
            {hints[field.field_key] && <span className="mt-1 block text-xs text-muted-foreground">{hints[field.field_key]}</span>}
          </label>;
        })}
      </fieldset>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="flex justify-end"><Button type="submit" disabled={Boolean(blocked) || saving || (editing && Object.keys(changes).length === 0)}>{saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar agendamento"}</Button></div>
    </form>
  );
}
