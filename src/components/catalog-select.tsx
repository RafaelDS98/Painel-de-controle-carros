import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { catalogLabels, cleanName, hasSglocId, selectOptions, type CatalogItem, type CatalogKind } from "@/lib/catalog";

const ADD = "__add__";

/** Select de uma lista cadastrada com a última opção "Adicionar ..." (abre o cadastro). */
export function CatalogSelect({ kind, items, value, required, disabled, canAdd, onChange, onAdded }: {
  kind: CatalogKind; items: CatalogItem[]; value: string; required?: boolean; disabled?: boolean; canAdd: boolean;
  onChange: (value: string) => void; onAdded: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sglocId, setSglocId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const labels = catalogLabels[kind];
  const options = selectOptions(items, value);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const clean = cleanName(name);
    if (!clean) { setError("Informe o nome."); return; }
    const id = sglocId.trim() ? Number(sglocId) : null;
    if (id !== null && (!Number.isInteger(id) || id <= 0)) { setError("O ID SGLOC deve ser um número inteiro."); return; }
    setBusy(true); setError("");
    const { data, error: rpcError } = await supabase.rpc("catalog_add", { _kind: kind, _name: clean, _source: "manual", ...(id !== null ? { _sgloc_id: id } : {}) });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    const saved = (data as { name?: string } | null)?.name ?? clean;
    await onAdded();
    onChange(saved);
    setOpen(false); setName(""); setSglocId("");
  }

  return <>
    <select value={value} required={required} disabled={disabled} onChange={(event) => {
      if (event.target.value === ADD) { setError(""); setOpen(true); return; }
      onChange(event.target.value);
    }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
      <option value="">Selecione</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
      {canAdd && <option value={ADD}>{labels.add}</option>}
    </select>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{labels.add.replace("...", "")}</DialogTitle><DialogDescription>O novo item fica disponível para todos e já é selecionado.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <label className="block text-sm">Nome *<Input autoFocus value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></label>
          {hasSglocId(kind) && <label className="block text-sm">ID {kind === "store" ? "da loja" : "do operador"} no SGLOC
            <Input inputMode="numeric" value={sglocId} onChange={(e) => setSglocId(e.target.value)} />
            <span className="mt-1 block text-xs text-muted-foreground">{kind === "store" ? "Sem ID, a loja fica \"sem vínculo SGLOC\" e agendamentos dela não são enviados ao SGLOC até o master informar o ID." : "Opcional."}</span></label>}
          {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
