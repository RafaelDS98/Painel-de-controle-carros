import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { PERMISSIONS, permissionDefault } from "@/lib/permissions";

const ROLE: Record<string, string> = {
  master: "Master",
  gerente: "Gerente",
  atendimento: "Atendimento",
  oficina: "Oficina",
};

type Override = { user_id: string; permission: string; allowed: boolean };

/** Tela master: liga/desliga cada aba e ação por usuário. "Padrão" segue o perfil. */
export function PermissionsPanel({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const users = useQuery({
    queryKey: ["perm-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_users_with_roles");
      if (error) throw error;
      return data ?? [];
    },
  });
  const overrides = useQuery({
    queryKey: ["perm-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("user_id,permission,allowed");
      if (error) throw error;
      return (data ?? []) as Override[];
    },
  });
  const map = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const o of overrides.data ?? []) m.set(`${o.user_id}|${o.permission}`, o.allowed);
    return m;
  }, [overrides.data]);
  const list = (users.data ?? []).filter((u) => {
    const q = search.trim().toLowerCase();
    return !q || `${u.full_name ?? ""} ${u.email ?? ""}`.toLowerCase().includes(q);
  });

  async function set(userId: string, perm: string, value: "default" | "yes" | "no") {
    setBusy(`${userId}|${perm}`);
    const res =
      value === "default"
        ? await supabase
            .from("user_permissions")
            .delete()
            .eq("user_id", userId)
            .eq("permission", perm)
        : await supabase.from("user_permissions").upsert({
            user_id: userId,
            permission: perm,
            allowed: value === "yes",
            updated_by: currentUserId,
            updated_at: new Date().toISOString(),
          });
    setBusy("");
    if (res.error) {
      toast.error("Não foi possível salvar a permissão.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["perm-overrides"] });
    toast.success("Permissão atualizada");
  }

  if (users.isError || overrides.isError)
    return (
      <p role="alert" className="text-destructive">
        Não foi possível carregar as permissões.
      </p>
    );

  const selected =
    (users.data ?? []).find((u) => u.user_id === selectedId) ?? list[0] ?? null;
  const locked = !selected || selected.role === "master" || selected.user_id === currentUserId;

  function Box({ perm, label }: { perm: string; label?: string }) {
    if (!selected) return null;
    const k = `${selected.user_id}|${perm}`;
    const def = permissionDefault(selected.role, perm);
    const on = locked ? selected.role === "master" || def : map.has(k) ? !!map.get(k) : def;
    const custom = !locked && map.has(k);
    const name = PERMISSIONS.find((p) => p.key === perm)?.label ?? perm;
    return (
      <label
        className="inline-flex items-center gap-1.5 text-xs"
        title={custom ? "Exceção individual" : "Padrão do perfil"}
      >
        <input
          type="checkbox"
          checked={on}
          aria-label={name}
          disabled={locked || busy === k || !selected.role}
          onChange={() => {
            const next = !on;
            void set(selected.user_id, perm, next === def ? "default" : next ? "yes" : "no");
          }}
          className="size-4 cursor-pointer accent-success disabled:cursor-not-allowed disabled:opacity-60"
        />
        {label && <span>{label}</span>}
        {custom && <span className="size-1.5 rounded-full bg-primary" aria-label="exceção" />}
      </label>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Selecione um usuário e marque o que fica liberado. Já vem marcado o padrão do perfil; o
        ponto azul indica exceção individual. Master tem acesso total e você não altera a si mesmo.
      </p>
      <div className="grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-md border">
          <div className="border-b p-2">
            <Input
              placeholder="Buscar usuário"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <ul className="max-h-[60vh] overflow-y-auto text-sm">
            {users.isLoading && <li className="p-3 text-muted-foreground">Carregando…</li>}
            {list.map((u) => (
              <li key={u.user_id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(u.user_id)}
                  className={`w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted ${
                    selected?.user_id === u.user_id ? "bg-muted font-medium" : ""
                  }`}
                >
                  <span className="block truncate">{u.full_name || u.email || "—"}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {ROLE[u.role ?? ""] ?? "Sem perfil"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="min-w-0 rounded-md border">
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b px-3 py-2 text-sm">
                <span className="truncate font-medium">
                  {selected.full_name || selected.email}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {selected.email || "—"} · {ROLE[selected.role ?? ""] ?? "Sem perfil"}
                  </span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary text-xs text-primary-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Menu</th>
                      {["Acessar", "Incluir", "Alterar", "Excluir"].map((h) => (
                        <th key={h} className="w-24 px-2 py-1.5 text-center font-medium">
                          {h}
                        </th>
                      ))}
                      <th className="px-3 py-1.5 text-left font-medium">Outras ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MATRIX.map((r) => (
                      <tr key={r.menu} className="border-t">
                        <td className="px-3 py-1.5">{r.menu}</td>
                        {(["access", "create", "edit", "delete"] as const).map((c) => (
                          <td key={c} className="px-2 py-1.5 text-center">
                            {r[c] ? <Box perm={r[c]!} /> : null}
                          </td>
                        ))}
                        <td className="px-3 py-1.5">
                          <div className="flex flex-wrap gap-3">
                            {r.other?.map((o) => (
                              <Box key={o.perm} perm={o.perm} label={o.label} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
          )}
        </section>
      </div>
    </div>
  );
}

type Row = {
  menu: string;
  access?: string;
  create?: string;
  edit?: string;
  delete?: string;
  other?: { perm: string; label: string }[];
};

const MATRIX: Row[] = [
  {
    menu: "Agenda de Manutenção",
    access: "module.agenda",
    other: [{ perm: "action.forward_workshop", label: "Encaminhar para oficina" }],
  },
  { menu: "Pátio da Oficina", access: "module.oficina" },
  { menu: "Históricos", access: "module.historicos" },
  { menu: "Ordens de Serviço", access: "module.os", create: "action.create_os" },
  {
    menu: "Veículos",
    access: "module.veiculos",
    other: [{ perm: "action.manage_vehicles", label: "Cadastrar/editar veículos" }],
  },
  {
    menu: "Notícias",
    access: "module.noticias",
    create: "action.news_create",
    edit: "action.news_edit",
    delete: "action.news_delete",
  },
  { menu: "Home", edit: "action.home_layout" },
];
