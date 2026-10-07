import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EMPTY_OPTION, foldedOptions } from "@/lib/agenda-safety";
import { setAdvancedText, toggleAdvancedValue, URGENT_NO, URGENT_YES, type AdvancedField, type AdvancedFilters } from "@/lib/advanced-filter";

export type SavedView = { id: string; name: string; filters: unknown };

function ChoiceField({ field, options, selected, onToggle }: { field: AdvancedField; options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const shown = options.filter((option) => !query || option.toLowerCase().includes(query.toLowerCase()) || selected.includes(option));
  return <fieldset className="space-y-2 border-b pb-3">
    <legend className="text-sm font-semibold">{field.label}{selected.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{selected.length} selecionado(s)</span>}</legend>
    {options.length > 8 && <Input value={query} placeholder="Buscar opção" aria-label={`Buscar em ${field.label}`} onChange={(e) => setQuery(e.target.value)} />}
    <div className="max-h-44 space-y-1 overflow-y-auto">
      {shown.map((option) => <label key={option} className="flex min-h-9 items-center gap-2 text-sm"><Checkbox checked={selected.includes(option)} onCheckedChange={() => onToggle(option)} />{option === EMPTY_OPTION ? "Não informado" : option}</label>)}
      {shown.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma opção.</p>}
    </div>
  </fieldset>;
}

/** Painel lateral do filtro avançado: campos gerados das configurações, chips ficam na agenda e visões salvas por usuário. */
export function AdvancedFilterDrawer({ open, onOpenChange, userId, fields, optionsFor, value, onChange, views, onViewsChanged, onApplyView, snapshot }: {
  open: boolean; onOpenChange: (open: boolean) => void; userId: string;
  fields: AdvancedField[]; optionsFor: (key: string) => string[];
  value: AdvancedFilters; onChange: (next: AdvancedFilters) => void;
  views: SavedView[]; onViewsChanged: () => Promise<void>; onApplyView: (view: SavedView) => void;
  snapshot: () => Record<string, unknown>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setError(""); setName(""); } }, [open]);
  const options = useMemo(() => Object.fromEntries(fields.filter((f) => f.kind === "choice").map((f) => [f.key, f.key === "__urgent" ? [URGENT_YES, URGENT_NO] : foldedOptions(optionsFor(f.key))])), [fields, optionsFor]);

  async function saveView(event: React.FormEvent) {
    event.preventDefault();
    const label = name.trim();
    if (!label) { setError("Dê um nome à visão."); return; }
    setBusy(true); setError("");
    const existing = views.find((view) => view.name.trim().toLowerCase() === label.toLowerCase());
    const payload = { filters: snapshot() as never };
    const { error: failure } = existing ? await supabase.from("saved_views").update(payload).eq("id", existing.id) : await supabase.from("saved_views").insert({ user_id: userId, name: label, ...payload });
    setBusy(false);
    if (failure) { setError("Não foi possível salvar a visão."); return; }
    setName(""); await onViewsChanged();
  }
  async function removeView(view: SavedView) {
    setBusy(true); setError("");
    const { error: failure } = await supabase.from("saved_views").delete().eq("id", view.id);
    setBusy(false);
    if (failure) { setError("Não foi possível remover a visão."); return; }
    await onViewsChanged();
  }

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
      <SheetHeader><SheetTitle>Filtros avançados</SheetTitle><SheetDescription>Combine campos da agenda. Dentro de um campo vale “ou”; entre campos vale “e”.</SheetDescription></SheetHeader>
      <div className="mt-4 space-y-4">
        <section className="space-y-2 border-b pb-3" aria-label="Visões salvas">
          <h3 className="text-sm font-semibold">Visões salvas</h3>
          {views.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma visão salva ainda.</p>}
          {views.map((view) => <div key={view.id} className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="min-w-0 flex-1 justify-start" onClick={() => onApplyView(view)}><span className="truncate">{view.name}</span></Button>
            <Button variant="ghost" size="icon" aria-label={`Remover visão ${view.name}`} disabled={busy} onClick={() => void removeView(view)}><Trash2 /></Button>
          </div>)}
          <form onSubmit={saveView} className="flex gap-2"><Input value={name} maxLength={80} placeholder="Nome da visão atual" aria-label="Nome da visão" onChange={(e) => setName(e.target.value)} /><Button type="submit" size="sm" disabled={busy}>Salvar</Button></form>
          <p className="text-xs text-muted-foreground">Guarda busca, período, filtros e seleções feitas aqui. Salvar com o mesmo nome atualiza a visão.</p>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        </section>
        {fields.map((field) => field.kind === "text"
          ? <label key={field.key} className="block space-y-1 border-b pb-3 text-sm font-semibold">{field.label}<Input value={value[field.key]?.[0] ?? ""} placeholder="Contém…" onChange={(e) => onChange(setAdvancedText(value, field.key, e.target.value))} /></label>
          : <ChoiceField key={field.key} field={field} options={options[field.key] ?? []} selected={value[field.key] ?? []} onToggle={(option) => onChange(toggleAdvancedValue(value, field.key, option))} />)}
        <Button variant="outline" className="w-full" onClick={() => onChange({})}>Limpar filtros avançados</Button>
      </div>
    </SheetContent>
  </Sheet>;
}
