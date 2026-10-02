import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { colorNames, fieldKey, statusColors, type FieldDefinition, type StatusOption } from "@/lib/agenda-config";
import { UserRolesPanel } from "@/components/user-roles-panel";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; statuses: StatusOption[]; fields: FieldDefinition[]; onRefresh: () => Promise<void>; currentUserId: string };
type StatusDraft = { id?: string; label: string; color_token: string; sort_order: number; is_completion: boolean };
type FieldDraft = { id?: string; label: string; field_type: string; select_options: string; sort_order: number; visible: boolean; required: boolean; storage: string; field_key: string };
const fieldTypes = { text: "Texto", textarea: "Texto longo", date: "Data", select: "Lista de opções" };
const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";
const fromField = (field: FieldDefinition): FieldDraft => ({ id: field.id, label: field.label, field_type: field.field_type, select_options: Array.isArray(field.select_options) ? field.select_options.join(", ") : "", sort_order: field.sort_order, visible: field.visible, required: field.required, storage: field.storage, field_key: field.field_key });

export function AgendaSettings({ open, onOpenChange, statuses, fields, onRefresh, currentUserId }: Props) {
  const [tab, setTab] = useState<"statuses" | "fields" | "users">("statuses");
  const [statusDraft, setStatusDraft] = useState<StatusDraft | null>(null);
  const [fieldDraft, setFieldDraft] = useState<FieldDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ type: "status" | "field"; id: string; label: string } | null>(null);
  async function perform(action: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(true); setError("");
    try {
      const result = await action();
      if (result.error) { setError(result.error.message); return false; }
      await onRefresh();
      return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar."); return false; }
    finally { setBusy(false); }
  }
  async function saveStatus(event: React.FormEvent) {
    event.preventDefault();
    if (!statusDraft) return;
    const label = statusDraft.label.trim();
    if (!label) { setError("Informe o nome da situação."); return; }
    const values = { label, color_token: statusDraft.color_token, sort_order: Number(statusDraft.sort_order), is_completion: statusDraft.is_completion };
    const id = statusDraft.id;
    if (await perform(() => id ? supabase.from("status_options").update(values).eq("id", id) : supabase.from("status_options").insert(values))) setStatusDraft(null);
  }
  async function saveField(event: React.FormEvent) {
    event.preventDefault();
    if (!fieldDraft) return;
    const label = fieldDraft.label.trim();
    const options = fieldDraft.select_options.split(",").map((value) => value.trim()).filter(Boolean);
    if (!label || (fieldDraft.field_type === "select" && !options.length)) { setError("Informe o nome e, para uma lista, as opções."); return; }
    const values = { label, field_type: fieldDraft.field_type, select_options: fieldDraft.field_type === "select" ? options : null, visible: fieldDraft.visible, required: fieldDraft.required, sort_order: Number(fieldDraft.sort_order) };
    const id = fieldDraft.id;
    const key = fieldKey(label);
    if (!id && (!/^[a-z][a-z0-9_]*$/.test(key) || fields.some((field) => field.field_key === key))) { setError("Escolha outro nome para o campo."); return; }
    const existing = fields.find((field) => field.id === id);
    const safeValues = existing?.storage === "column" ? { label, visible: values.visible, required: values.required, sort_order: values.sort_order } : values;
    if (await perform(() => id ? supabase.from("custom_field_definitions").update(safeValues).eq("id", id) : supabase.from("custom_field_definitions").insert({ ...values, field_key: key, storage: "custom" }))) setFieldDraft(null);
  }
  async function remove() {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    const success = await perform(() => type === "status" ? supabase.from("status_options").delete().eq("id", id) : supabase.from("custom_field_definitions").delete().eq("id", id));
    if (success) setConfirmDelete(null);
  }
  return <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); setError(""); setStatusDraft(null); setFieldDraft(null); setConfirmDelete(null); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader><DialogTitle>Configurações</DialogTitle><DialogDescription>Agenda ANPEX</DialogDescription></DialogHeader>
      <div className="flex gap-2 border-b pb-3" role="tablist" aria-label="Configurações">
        <Button role="tab" aria-selected={tab === "statuses"} variant={tab === "statuses" ? "default" : "outline"} onClick={() => { setTab("statuses"); setError(""); setFieldDraft(null); }}>Situações</Button>
        <Button role="tab" aria-selected={tab === "fields"} variant={tab === "fields" ? "default" : "outline"} onClick={() => { setTab("fields"); setError(""); setStatusDraft(null); }}>Campos do formulário</Button>
        <Button role="tab" aria-selected={tab === "users"} variant={tab === "users" ? "default" : "outline"} onClick={() => { setTab("users"); setError(""); setStatusDraft(null); setFieldDraft(null); }}>Usuários e permissões</Button>
      </div>
      {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {confirmDelete && <div role="alertdialog" aria-label="Confirmar remoção" className="flex flex-wrap items-center gap-3 border-b pb-3 text-sm"><span>Remover “{confirmDelete.label}”?</span><Button size="sm" variant="destructive" disabled={busy} onClick={remove}>Remover</Button><Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button></div>}
      {tab === "users" ? <UserRolesPanel currentUserId={currentUserId} /> : tab === "statuses" ? <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Situações</h3><Button size="sm" variant="outline" onClick={() => { setStatusDraft({ label: "", color_token: "status-blue", sort_order: (Math.max(0, ...statuses.map((row) => row.sort_order)) + 1), is_completion: false }); setError(""); }}><Plus /> Nova situação</Button></div>
        {statuses.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-3 border-b py-2 text-sm"><span className={cn("h-6 w-8 rounded border", statusColors[row.color_token])} aria-label={colorNames[row.color_token]} /><span className="min-w-0 flex-1 font-medium">{row.label}{row.is_completion && <span className="ml-2 text-xs text-muted-foreground">Conclusão</span>}</span><span className="text-xs text-muted-foreground">#{row.sort_order}</span><Button size="icon" variant="ghost" aria-label={`Editar ${row.label}`} onClick={() => { setStatusDraft({ ...row }); setError(""); }}><Pencil /></Button><Button size="icon" variant="ghost" aria-label={`Remover ${row.label}`} onClick={() => { setConfirmDelete({ type: "status", id: row.id, label: row.label }); setError(""); }}><Trash2 /></Button></div>)}
        {statusDraft && <form onSubmit={saveStatus} className="grid gap-3 border-t pt-4 sm:grid-cols-2"><h4 className="font-semibold sm:col-span-2">{statusDraft.id ? "Editar situação" : "Nova situação"}</h4><label className="text-sm">Nome<Input required value={statusDraft.label} onChange={(e) => setStatusDraft({ ...statusDraft, label: e.target.value })} /></label><label className="text-sm">Cor<select className={inputClass} value={statusDraft.color_token} onChange={(e) => setStatusDraft({ ...statusDraft, color_token: e.target.value })}>{Object.entries(colorNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label className="text-sm">Ordem<Input type="number" value={statusDraft.sort_order} onChange={(e) => setStatusDraft({ ...statusDraft, sort_order: Number(e.target.value) })} /></label><label className="flex items-center gap-2 text-sm"><Checkbox checked={statusDraft.is_completion} onCheckedChange={(value) => setStatusDraft({ ...statusDraft, is_completion: value === true })} />Situação de conclusão</label><div className="flex gap-2 sm:col-span-2"><Button disabled={busy} type="submit">Salvar</Button><Button type="button" variant="outline" onClick={() => setStatusDraft(null)}>Cancelar</Button></div></form>}
      </section> : <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Campos do formulário</h3><Button size="sm" variant="outline" onClick={() => { setFieldDraft({ label: "", field_type: "text", select_options: "", sort_order: Math.max(0, ...fields.map((row) => row.sort_order)) + 10, visible: true, required: false, storage: "custom", field_key: "" }); setError(""); }}><Plus /> Novo campo</Button></div>
        {fields.map((row) => <div key={row.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-sm"><span className="min-w-0 flex-1 font-medium">{row.label}<span className="ml-2 text-xs font-normal text-muted-foreground">{row.storage === "column" ? "Campo padrão" : "Personalizado"}</span></span><span className="text-xs text-muted-foreground">{fieldTypes[row.field_type as keyof typeof fieldTypes] || row.field_type} · {row.visible ? "Visível" : "Oculto"} · {row.required ? "Obrigatório" : "Opcional"} · #{row.sort_order}</span><Button size="icon" variant="ghost" aria-label={`Editar campo ${row.label}`} onClick={() => { setFieldDraft(fromField(row)); setError(""); }}><Pencil /></Button>{row.storage === "custom" && <Button size="icon" variant="ghost" aria-label={`Remover campo ${row.label}`} onClick={() => { setConfirmDelete({ type: "field", id: row.id, label: row.label }); setError(""); }}><Trash2 /></Button>}</div>)}
        {fieldDraft && <form onSubmit={saveField} className="grid gap-3 border-t pt-4 sm:grid-cols-2"><h4 className="font-semibold sm:col-span-2">{fieldDraft.id ? "Editar campo" : "Novo campo"}</h4><label className="text-sm">Nome<Input required value={fieldDraft.label} onChange={(e) => setFieldDraft({ ...fieldDraft, label: e.target.value })} /></label>{fieldDraft.storage === "custom" && <label className="text-sm">Tipo<select className={inputClass} value={fieldDraft.field_type} onChange={(e) => setFieldDraft({ ...fieldDraft, field_type: e.target.value })}>{Object.entries(fieldTypes).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>}{fieldDraft.field_type === "select" && fieldDraft.storage === "custom" && <label className="text-sm sm:col-span-2">Opções separadas por vírgula<Input required value={fieldDraft.select_options} onChange={(e) => setFieldDraft({ ...fieldDraft, select_options: e.target.value })} /></label>}<label className="text-sm">Ordem<Input type="number" value={fieldDraft.sort_order} onChange={(e) => setFieldDraft({ ...fieldDraft, sort_order: Number(e.target.value) })} /></label><div className="flex items-center gap-5"><label className="flex items-center gap-2 text-sm"><Checkbox checked={fieldDraft.visible} onCheckedChange={(value) => setFieldDraft({ ...fieldDraft, visible: value === true })} />Visível</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={fieldDraft.required} onCheckedChange={(value) => setFieldDraft({ ...fieldDraft, required: value === true })} />Obrigatório</label></div><div className="flex gap-2 sm:col-span-2"><Button disabled={busy} type="submit">Salvar</Button><Button type="button" variant="outline" onClick={() => setFieldDraft(null)}>Cancelar</Button></div></form>}
      </section>}
    </DialogContent>
  </Dialog>;
}
