import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OsConsultaPanel } from "@/components/os-consulta";
import { SearchableSelect } from "@/components/searchable-select";
import {
  itemTotal,
  money,
  osDate,
  parseSearch,
  TIPO_ATENDIMENTO,
  type OsItem,
  type OsRow,
} from "@/lib/os";

type Opt = { id: string | number; label: string };
type Vehicle = {
  plate: string;
  modelo: string | null;
  fabricante: string | null;
  categoria: string | null;
  km_atual: number | null;
  loja_op: string | null;
  ano: number | null;
};
type Config = {
  tipos: Opt[];
  status: (Opt & { color?: string; allows_finalize?: boolean })[];
  centros: Opt[];
  stores: Opt[];
  workshops: Opt[];
  mechanics: string[];
};

/** Remove campos vazios antes de chamar o banco. */
function clean<T extends Record<string, unknown>>(
  o: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as never;
}

const sel = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function errMsg(e: unknown) {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : "Erro inesperado. Tente de novo.";
}

/** Listas usadas pelas telas de O.S.: tudo vem das tabelas reais (configuração de O.S., lojas SGLOC, oficinas e mecânicos). */
export function useOsConfig() {
  return useQuery({
    queryKey: ["os-config"],
    queryFn: async (): Promise<Config> => {
      const [cfg, stores, workshops, mechanics] = await Promise.all([
        supabase.rpc("os_config_list"),
        supabase.from("sgloc_stores").select("store_id, code, label").order("code"),
        supabase.from("workshops").select("id, name").eq("active", true).order("name"),
        supabase
          .from("catalog_items")
          .select("name")
          .eq("kind", "mechanic")
          .eq("active", true)
          .order("name"),
      ]);
      if (cfg.error) throw cfg.error;
      const c = (cfg.data ?? {}) as Record<string, Array<Record<string, unknown>>>;
      const map = (rows: Array<Record<string, unknown>> | undefined, label: string) =>
        (rows ?? []).map((r) => ({
          ...r,
          id: r["id"] as string | number,
          label: String(r[label] ?? "—"),
        }));
      return {
        tipos: map(c["tipos"], "label"),
        status: map(c["status"], "label") as Config["status"],
        centros: map(c["centros_custo"], "name"),
        stores: (stores.data ?? []).map((s) => ({
          id: s.store_id,
          label: s.label ? `${s.code} — ${s.label}` : s.code,
        })),
        workshops: (workshops.data ?? []).map((w) => ({ id: w.id, label: w.name })),
        mechanics: (mechanics.data ?? []).map((m) => m.name),
      };
    },
  });
}

function Shell({
  title,
  children,
  back,
}: {
  title: string;
  children: React.ReactNode;
  back?: boolean;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[1400px] space-y-5 px-5 py-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="flex gap-2">
            {back && (
              <Button variant="outline" asChild>
                <Link to="/ordens-servico">Voltar à lista</Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link to="/">Ir para a Agenda</Link>
            </Button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function Badge({
  label,
  color,
}: {
  label?: string | null | undefined;
  color?: string | null | undefined;
}) {
  const hex = color && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
      <span
        className="h-2 w-2 rounded-full bg-muted-foreground"
        style={hex ? { backgroundColor: hex } : undefined}
      />
      {label || "—"}
    </span>
  );
}

export function OsListPage({ canCreate }: { canCreate: boolean }) {
  return (
    <Shell title="Ordens de Serviço">
      {canCreate && (
        <div className="flex justify-end">
          <Button asChild>
            <Link to="/ordens-servico/nova">Nova O.S.</Link>
          </Button>
        </div>
      )}
      <OsConsultaPanel />
    </Shell>
  );
}

export function OsNewPage({ appointmentId }: { appointmentId?: string | undefined }) {
  const config = useOsConfig();
  const navigate = useNavigate();
  const appt = useQuery({
    queryKey: ["os-appt", appointmentId],
    enabled: Boolean(appointmentId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, plate, km_scheduled, store_id, workshop, issue, os_number")
        .eq("id", appointmentId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const vehicles = useQuery({
    queryKey: ["vehicles-lite"],
    queryFn: async (): Promise<Vehicle[]> => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("plate, modelo, fabricante, categoria, km_atual, loja_op, ano")
        .eq("active", true)
        .order("plate")
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const normPlate = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const [f, setF] = useState({
    plate: "",
    km: "",
    store_id: "",
    workshop_id: "",
    tipo_id: "",
    centro_custo_id: "",
    tipo_atendimento: "N",
    previsao_conclusao: "",
    condutor_nome: "",
    condutor_contato: "",
    solicitante: "",
    externa_ref: "",
    obs1: "",
  });
  const [filled, setFilled] = useState(false);
  const [saving, setSaving] = useState(false);
  if (appt.data && !filled && config.data) {
    const w = config.data.workshops.find(
      (x) => x.label.toLowerCase() === (appt.data!.workshop ?? "").toLowerCase(),
    );
    setF((p) => ({
      ...p,
      plate: appt.data!.plate ?? "",
      km: appt.data!.km_scheduled ? String(appt.data!.km_scheduled) : "",
      store_id: appt.data!.store_id ? String(appt.data!.store_id) : "",
      workshop_id: w ? String(w.id) : "",
      obs1: appt.data!.issue ?? "",
    }));
    setFilled(true);
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF({ ...f, [k]: e.target.value });
  const vehicle = vehicles.data?.find((v) => normPlate(v.plate) === normPlate(f.plate)) ?? null;
  function setPlate(value: string) {
    const v = vehicles.data?.find((x) => normPlate(x.plate) === normPlate(value));
    if (!v) {
      setF({ ...f, plate: value });
      return;
    }
    const store = config.data?.stores.find((s) => s.label.split(" — ")[0] === v.loja_op);
    setF({
      ...f,
      plate: v.plate,
      km: f.km || (v.km_atual ? String(v.km_atual) : ""),
      store_id: f.store_id || (store ? String(store.id) : ""),
    });
  }
  const pick = (k: "workshop_id" | "centro_custo_id", list: Opt[] | undefined) => ({
    value: list?.find((o) => String(o.id) === f[k])?.label ?? "",
    options: (list ?? []).map((o) => o.label),
    onChange: (label: string) =>
      setF({ ...f, [k]: String(list?.find((o) => o.label === label)?.id ?? "") }),
  });
  async function save() {
    const missing = [
      !f.plate && "Placa",
      !f.km && "KM",
      !f.store_id && "Loja",
      !f.workshop_id && "Oficina",
      !f.tipo_id && "Tipo",
      !f.centro_custo_id && "Centro de custo",
    ].filter(Boolean);
    if (missing.length) {
      toast.error(`Preencha: ${missing.join(", ")}.`);
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc(
      "os_create",
      clean({
        _plate: f.plate,
        _km: Number(f.km),
        _store_id: Number(f.store_id),
        _workshop_id: f.workshop_id,
        _tipo_id: Number(f.tipo_id),
        _centro_custo_id: f.centro_custo_id,
        _tipo_atendimento: f.tipo_atendimento,
        _appointment_id: appointmentId ?? undefined,
        _previsao_conclusao: f.previsao_conclusao || undefined,
        _condutor_nome: f.condutor_nome || undefined,
        _condutor_contato: f.condutor_contato || undefined,
        _solicitante: f.solicitante || undefined,
        _externa_ref: f.externa_ref || undefined,
        _obs1: f.obs1 || undefined,
      }),
    );
    setSaving(false);
    if (error) {
      toast.error(`Não foi possível criar a O.S. ${errMsg(error)}`);
      return;
    }
    const r = data as { id: string; numero: number };
    toast.success(`O.S. ${r.numero} criada.`);
    navigate({ to: "/ordens-servico/$id", params: { id: r.id } });
  }
  const c = config.data;
  return (
    <Shell title="Nova Ordem de Serviço" back>
      {appt.data?.os_number && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          Este agendamento já tem a O.S. {appt.data.os_number}.
        </p>
      )}
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label>Placa *</Label>
          <Input
            list="os-plates"
            value={f.plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="Digite a placa"
          />
          <datalist id="os-plates">
            {vehicles.data?.map((v) => (
              <option key={v.plate} value={v.plate}>
                {[v.modelo, v.categoria].filter(Boolean).join(" · ")}
              </option>
            ))}
          </datalist>
          {f.plate && (
            <p className="mt-1 text-xs text-muted-foreground">
              {vehicle
                ? [
                    vehicle.fabricante,
                    vehicle.modelo,
                    vehicle.ano,
                    vehicle.categoria,
                    vehicle.km_atual != null ? `KM atual ${vehicle.km_atual}` : null,
                    vehicle.loja_op ? `Loja ${vehicle.loja_op}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Placa não encontrada na frota."}
            </p>
          )}
        </div>
        <div>
          <Label>KM *</Label>
          <Input value={f.km} onChange={set("km")} inputMode="numeric" />
        </div>
        <div>
          <Label>Tipo de atendimento</Label>
          <select className={sel} value={f.tipo_atendimento} onChange={set("tipo_atendimento")}>
            {Object.entries(TIPO_ATENDIMENTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Loja *</Label>
          <select className={sel} value={f.store_id} onChange={set("store_id")}>
            <option value="">Selecione</option>
            {c?.stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Oficina *</Label>
          <div className="flex">
            <SearchableSelect label="Selecione" {...pick("workshop_id", c?.workshops)} />
          </div>
        </div>
        <div>
          <Label>Tipo de O.S. *</Label>
          <select className={sel} value={f.tipo_id} onChange={set("tipo_id")}>
            <option value="">Selecione</option>
            {c?.tipos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Centro de custo *</Label>
          <div className="flex">
            <SearchableSelect label="Selecione" {...pick("centro_custo_id", c?.centros)} />
          </div>
        </div>
        <div>
          <Label>Previsão de conclusão</Label>
          <Input type="date" value={f.previsao_conclusao} onChange={set("previsao_conclusao")} />
        </div>
        <div>
          <Label>O.S. externa</Label>
          <Input value={f.externa_ref} onChange={set("externa_ref")} />
        </div>
        <div>
          <Label>Condutor</Label>
          <Input value={f.condutor_nome} onChange={set("condutor_nome")} />
        </div>
        <div>
          <Label>Contato do condutor</Label>
          <Input value={f.condutor_contato} onChange={set("condutor_contato")} />
        </div>
        <div>
          <Label>Solicitante</Label>
          <Input value={f.solicitante} onChange={set("solicitante")} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label>Observação / problema</Label>
          <Textarea value={f.obs1} onChange={set("obs1")} />
        </div>
      </div>
      {c && !c.centros.length && (
        <p className="text-sm text-muted-foreground">
          Nenhum centro de custo cadastrado ainda — cadastre antes de criar a O.S.
        </p>
      )}
      <Button onClick={save} disabled={saving}>
        {saving ? "Salvando…" : "Criar O.S."}
      </Button>
    </Shell>
  );
}

export function OsDetailPage({ id }: { id: string }) {
  const config = useOsConfig();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["os-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("os_get_detail", { _os_id: id });
      if (error) throw error;
      const d = (data ?? {}) as {
        os?: OsRow | null;
        items?: OsItem[];
        observations?: { id: string; content: string; created_at: string }[];
      };
      return { os: d.os ?? null, items: d.items ?? [], observations: d.observations ?? [] };
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["os-detail", id] });
  const [item, setItem] = useState({
    description: "",
    qty: "1",
    unit_price: "",
    item_type: "servico",
    mechanic_name: "",
  });
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(p: PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    const { error } = await p;
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return false;
    }
    toast.success(ok);
    reload();
    return true;
  }
  if (detail.isLoading)
    return (
      <Shell title="Ordem de Serviço" back>
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </Shell>
    );
  if (detail.isError || !detail.data?.os)
    return (
      <Shell title="Ordem de Serviço" back>
        <p className="text-sm text-destructive">Ordem não encontrada ou sem permissão.</p>
      </Shell>
    );
  const { os, items, observations } = detail.data;
  const closed = Boolean(os.closed_at);
  const total = items.reduce((s, i) => s + (Number(i.total) || itemTotal(i.qty, i.unit_price)), 0);
  const info: [string, unknown][] = [
    ["Placa", os.plate],
    ["Abertura", osDate(os.opened_at)],
    ["Tipo", os.tipo_label],
    ["Atendimento", TIPO_ATENDIMENTO[String(os.tipo_atendimento)] ?? os.tipo_atendimento],
    ["Loja", os.store_code],
    ["Oficina", os.workshop_name],
    ["Centro de custo", os.centro_custo_name],
    ["KM", os.km],
    ["Previsão", osDate(os.previsao_conclusao)],
    ["O.S. externa", os.externa_ref],
    ["Condutor", os.condutor_nome],
    ["Observação", os.obs1],
  ];
  return (
    <Shell title={`O.S. ${os.numero}`} back>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <Badge label={String(os.status_label ?? "")} color={os.status_color} />
        {!closed && (
          <>
            <Label htmlFor="os-st" className="text-sm">
              Mudar situação
            </Label>
            <select
              id="os-st"
              className={`${sel} w-auto`}
              value={os.status_id}
              disabled={busy}
              onChange={(e) =>
                run(
                  supabase.rpc("os_transition_status", {
                    _os_id: id,
                    _new_status_id: Number(e.target.value),
                  }),
                  "Situação alterada.",
                )
              }
            >
              {config.data?.status.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                const km = window.prompt("KM final do veículo:", String(os.km ?? ""));
                if (km === null) return;
                if (!/^\d+$/.test(km.trim())) {
                  toast.error("Informe o KM só com números.");
                  return;
                }
                run(
                  supabase.rpc("os_finalize", {
                    _os_id: id,
                    _km_final: Number(km),
                    _tanque_final: "",
                    _gnv_final: "",
                    _posicao_final: "",
                  }),
                  "O.S. finalizada.",
                );
              }}
            >
              Finalizar O.S.
            </Button>
          </>
        )}
        {closed && (
          <span className="text-sm text-muted-foreground">
            Finalizada em {osDate(os.closed_at)}
          </span>
        )}
      </div>
      <dl className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        {info.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm">
              {v === null || v === undefined || v === "" ? "—" : String(v)}
            </dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Itens (peças e serviços) · {money(total)}</h2>
        {items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  {[
                    "Descrição",
                    "Tipo",
                    "Mecânico",
                    "Qtd",
                    "Unitário",
                    "Total",
                    "Aprovação",
                    "",
                  ].map((h) => (
                    <th key={h} className="px-2 py-1 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="px-2 py-1">{i.description}</td>
                    <td className="px-2 py-1">{i.item_type === "peca" ? "Peça" : "Serviço"}</td>
                    <td className="px-2 py-1">{i.mechanic_name || "—"}</td>
                    <td className="px-2 py-1">{i.qty}</td>
                    <td className="px-2 py-1">{money(i.unit_price)}</td>
                    <td className="px-2 py-1">
                      {money(i.total ?? itemTotal(i.qty, i.unit_price))}
                    </td>
                    <td className="px-2 py-1">{i.approval || "Pendente"}</td>
                    <td className="px-2 py-1">
                      {!closed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            window.confirm("Remover este item?") &&
                            run(
                              supabase.rpc("os_item_delete", { _item_id: i.id }),
                              "Item removido.",
                            )
                          }
                        >
                          Remover
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum item lançado.</p>
        )}
        {!closed && (
          <form
            className="grid gap-2 sm:grid-cols-6"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!item.description.trim() || !(Number(item.qty) > 0)) {
                toast.error("Informe descrição e quantidade.");
                return;
              }
              const ok = await run(
                supabase.rpc(
                  "os_item_add",
                  clean({
                    _os_id: id,
                    _description: item.description.trim(),
                    _qty: Number(item.qty),
                    _unit_price: Number(item.unit_price.replace(",", ".")) || 0,
                    _item_type: item.item_type,
                    _mechanic_name: item.mechanic_name || undefined,
                  }),
                ),
                "Item adicionado.",
              );
              if (ok)
                setItem({
                  description: "",
                  qty: "1",
                  unit_price: "",
                  item_type: item.item_type,
                  mechanic_name: item.mechanic_name,
                });
            }}
          >
            <Input
              className="sm:col-span-2"
              placeholder="Descrição"
              value={item.description}
              onChange={(e) => setItem({ ...item, description: e.target.value })}
            />
            <select
              className={sel}
              value={item.item_type}
              onChange={(e) => setItem({ ...item, item_type: e.target.value })}
            >
              <option value="servico">Serviço</option>
              <option value="peca">Peça</option>
            </select>
            <select
              className={sel}
              value={item.mechanic_name}
              onChange={(e) => setItem({ ...item, mechanic_name: e.target.value })}
            >
              <option value="">Mecânico</option>
              {config.data?.mechanics.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <Input
                aria-label="Quantidade"
                value={item.qty}
                onChange={(e) => setItem({ ...item, qty: e.target.value })}
                inputMode="decimal"
              />
              <Input
                aria-label="Valor unitário"
                placeholder="R$"
                value={item.unit_price}
                onChange={(e) => setItem({ ...item, unit_price: e.target.value })}
                inputMode="decimal"
              />
            </div>
            <Button type="submit" disabled={busy}>
              Adicionar
            </Button>
          </form>
        )}
      </section>
      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Observações do cliente</h2>
        {observations.map((o) => (
          <div key={o.id} className="rounded-md border p-2 text-sm">
            <p className="whitespace-pre-wrap">{o.content}</p>
            <p className="mt-1 text-xs text-muted-foreground">{osDate(o.created_at)}</p>
          </div>
        ))}
        {!observations.length && (
          <p className="text-sm text-muted-foreground">Nenhuma observação.</p>
        )}
        <div className="flex gap-2">
          <Textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Nova observação"
          />
          <Button
            disabled={busy || !obs.trim()}
            onClick={async () => {
              const { data: u } = await supabase.auth.getUser();
              if (
                await run(
                  supabase
                    .from("os_observacoes_cliente")
                    .insert({ os_id: id, content: obs.trim(), created_by: u.user?.id ?? null }),
                  "Observação registrada.",
                )
              )
                setObs("");
            }}
          >
            Salvar
          </Button>
        </div>
      </section>
    </Shell>
  );
}
