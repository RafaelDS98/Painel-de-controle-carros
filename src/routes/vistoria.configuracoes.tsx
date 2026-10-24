import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMyPermissions } from "@/lib/permissions";

export const Route = createFileRoute("/vistoria/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | ANPEXC Vistorias" },
      { name: "description", content: "Operações, grupos, campos e fotos da vistoria." },
      { property: "og:title", content: "Configurações | ANPEXC Vistorias" },
      { property: "og:description", content: "Operações, grupos, campos e fotos da vistoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Config,
});

const TABS = [
  { v: "campos", l: "Campos (dados)" },
  { v: "checklist", l: "Checklist" },
  { v: "fotos", l: "Fotos" },
] as const;
const KINDS = [
  { v: "check", l: "Checklist (Bom/Ruim/Atenção/N.A.)" },
  { v: "photo", l: "Foto" },
  { v: "text", l: "Texto" },
  { v: "number", l: "Número" },
] as const;
const BASES = [
  { v: "pre_vistoria", l: "Pré-vistoria" },
  { v: "entrega", l: "Entrega" },
  { v: "cautelar", l: "Cautelar" },
  { v: "coleta", l: "Coleta" },
  { v: "coleta_entrega", l: "Coleta com entrega" },
  { v: "autoinspecao", l: "Autoinspeção" },
] as const;

type Op = { id: string; name: string; base_type: string; sort: number; active: boolean };
type Group = { id: string; name: string; tab: string; sort: number; active: boolean };
type Field = {
  id: string;
  group_id: string;
  label: string;
  kind: string;
  required: boolean;
  sort: number;
  active: boolean;
};

const sel = "h-10 rounded-md border bg-background px-2 text-sm text-foreground";

function useConfig() {
  return useQuery({
    queryKey: ["inspection-config-admin"],
    queryFn: async () => {
      const [o, g, f] = await Promise.all([
        supabase.from("inspection_operation_types").select("id,name,base_type,sort,active").order("sort"),
        supabase.from("inspection_groups").select("id,name,tab,sort,active").order("sort"),
        supabase
          .from("inspection_fields")
          .select("id,group_id,label,kind,required,sort,active")
          .order("sort"),
      ]);
      if (o.error || g.error || f.error) throw o.error ?? g.error ?? f.error;
      return { ops: o.data as Op[], groups: g.data as Group[], fields: f.data as Field[] };
    },
  });
}

type Table = "inspection_operation_types" | "inspection_groups" | "inspection_fields";

function Config() {
  const perms = useMyPermissions();
  const q = useConfig();
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("fotos");

  async function save(table: Table, id: string | null, values: Record<string, unknown>) {
    const res = id
      ? await supabase.from(table).update(values as never).eq("id", id)
      : await supabase.from(table).insert(values as never);
    if (res.error) {
      toast.error("Não foi possível salvar. Confira se você tem permissão.");
      return;
    }
    toast.success("Salvo.");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["inspection-config-admin"] }),
      qc.invalidateQueries({ queryKey: ["inspection-config"] }),
      qc.invalidateQueries({ queryKey: ["inspection-optypes"] }),
    ]);
  }

  async function move<T extends { id: string; sort: number }>(table: Table, list: T[], i: number, d: -1 | 1) {
    const a = list[i];
    const b = list[i + d];
    if (!a || !b) return;
    await save(table, a.id, { sort: b.sort === a.sort ? a.sort + d : b.sort });
    await save(table, b.id, { sort: a.sort });
  }

  if (perms.isLoading || q.isLoading) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  if (!perms.data?.includes("action.inspection_config"))
    return <p className="p-6 text-sm text-muted-foreground">Sem acesso. Só quem tem permissão de configurar vistorias.</p>;
  if (q.error || !q.data) return <p className="p-6 text-sm text-destructive">Não foi possível carregar.</p>;

  const { ops, groups, fields } = q.data;
  const tabGroups = groups.filter((g) => g.tab === tab);
  const nextSort = (l: { sort: number }[]) => (l.length ? Math.max(...l.map((x) => x.sort)) + 1 : 1);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Configurações da vistoria</h1>
        <p className="text-sm text-muted-foreground">
          Crie e renomeie operações, grupos, campos e fotos. Desativar esconde das novas vistorias sem
          apagar as já feitas.
        </p>
      </div>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Tipos de operação</h2>
        {ops.map((o, i) => (
          <Row key={o.id} active={o.active} onToggle={() => void save("inspection_operation_types", o.id, { active: !o.active })}
            onUp={() => void move("inspection_operation_types", ops, i, -1)} onDown={() => void move("inspection_operation_types", ops, i, 1)}>
            <NameInput value={o.name} onSave={(name) => void save("inspection_operation_types", o.id, { name })} />
            <select className={sel} value={o.base_type} aria-label="Tipo base"
              onChange={(e) => void save("inspection_operation_types", o.id, { base_type: e.target.value })}>
              {BASES.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
            </select>
          </Row>
        ))}
        <Button variant="outline" size="sm"
          onClick={() => void save("inspection_operation_types", null, { name: "Nova operação", base_type: "entrega", sort: nextSort(ops) })}>
          <Plus /> Nova operação
        </Button>
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold">Grupos, campos e fotos</h2>
          {TABS.map((t) => (
            <Button key={t.v} size="sm" variant={tab === t.v ? "default" : "outline"} onClick={() => setTab(t.v)}>
              {t.l}
            </Button>
          ))}
        </div>
        {tabGroups.length === 0 && <p className="text-sm text-muted-foreground">Nenhum grupo nesta aba.</p>}
        {tabGroups.map((g, gi) => {
          const gf = fields.filter((f) => f.group_id === g.id);
          return (
            <div key={g.id} className="space-y-2 rounded-md border p-3">
              <Row active={g.active} onToggle={() => void save("inspection_groups", g.id, { active: !g.active })}
                onUp={() => void move("inspection_groups", tabGroups, gi, -1)} onDown={() => void move("inspection_groups", tabGroups, gi, 1)}>
                <NameInput value={g.name} bold onSave={(name) => void save("inspection_groups", g.id, { name })} />
                <select className={sel} value={g.tab} aria-label="Aba"
                  onChange={(e) => void save("inspection_groups", g.id, { tab: e.target.value })}>
                  {TABS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                </select>
              </Row>
              <div className="space-y-2 pl-4">
                {gf.map((f, fi) => (
                  <Row key={f.id} active={f.active} onToggle={() => void save("inspection_fields", f.id, { active: !f.active })}
                    onUp={() => void move("inspection_fields", gf, fi, -1)} onDown={() => void move("inspection_fields", gf, fi, 1)}>
                    <NameInput value={f.label} onSave={(label) => void save("inspection_fields", f.id, { label })} />
                    <select className={sel} value={f.kind} aria-label="Tipo do campo"
                      onChange={(e) => void save("inspection_fields", f.id, { kind: e.target.value })}>
                      {KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
                    </select>
                    <label className="flex h-10 items-center gap-2 text-sm">
                      <input type="checkbox" className="h-4 w-4 accent-primary" checked={f.required}
                        onChange={() => void save("inspection_fields", f.id, { required: !f.required })} />
                      Obrigatório
                    </label>
                  </Row>
                ))}
                <Button variant="outline" size="sm"
                  onClick={() => void save("inspection_fields", null, {
                    group_id: g.id,
                    label: tab === "fotos" ? "Nova foto" : "Novo campo",
                    kind: tab === "fotos" ? "photo" : tab === "checklist" ? "check" : "text",
                    required: false,
                    sort: nextSort(gf),
                  })}>
                  <Plus /> {tab === "fotos" ? "Nova foto" : "Novo campo"}
                </Button>
              </div>
            </div>
          );
        })}
        <Button variant="outline" size="sm"
          onClick={() => void save("inspection_groups", null, { name: "Novo grupo", tab, sort: nextSort(groups) })}>
          <Plus /> Novo grupo
        </Button>
      </section>
    </div>
  );
}

function NameInput({ value, onSave, bold }: { value: string; onSave: (v: string) => void; bold?: boolean }) {
  const [v, setV] = useState(value);
  const commit = () => {
    const t = v.trim();
    if (!t) return setV(value);
    if (t !== value) onSave(t);
  };
  return (
    <Input className={`h-10 min-w-48 flex-1 ${bold ? "font-semibold" : ""}`} value={v} aria-label="Nome"
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
  );
}

function Row({ children, active, onToggle, onUp, onDown }: {
  children: React.ReactNode; active: boolean; onToggle: () => void; onUp: () => void; onDown: () => void;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${active ? "" : "opacity-60"}`}>
      {children}
      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onUp} aria-label="Subir"><ArrowUp /></Button>
      <Button variant="ghost" size="icon" className="h-10 w-10" onClick={onDown} aria-label="Descer"><ArrowDown /></Button>
      <Button variant="outline" size="sm" className="h-10" onClick={onToggle}>{active ? "Desativar" : "Ativar"}</Button>
    </div>
  );
}
